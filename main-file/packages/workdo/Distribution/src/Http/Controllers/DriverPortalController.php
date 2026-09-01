<?php

namespace Workdo\Distribution\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\Driver;
use Workdo\Distribution\Services\DriverPortalService;
use Workdo\Distribution\Services\DriverService;

/**
 * What a signed-in driver sees on their phone: the stops assigned to them and
 * the actions that close one out.
 */
class DriverPortalController extends Controller
{
    public function __construct(
        private DriverService $drivers,
        private DriverPortalService $portal,
    ) {
    }

    public function home()
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        return Inertia::render('Distribution/Driver/Home', array_merge(
            $this->portal->dashboard($driver),
            ['driver' => $this->driverPayload($driver)]
        ));
    }

    /** The round tab: the stops themselves. */
    public function round()
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        $notes = DeliveryNote::with('items')
            ->where('driver_id', $driver->user_id)
            ->orderByRaw("CASE WHEN status IN ('pending','assigned','in_transit') THEN 0 ELSE 1 END")
            ->orderBy('sequence')
            ->orderByDesc('id')
            ->get()
            ->map(fn (DeliveryNote $note) => [
                'id' => $note->id,
                'reference' => $note->reference,
                'status' => $note->status,
                'total_amount' => (float) $note->total_amount,
                'collected_amount' => (float) $note->collected_amount,
                'recipient_name' => $note->recipient_name,
                'scheduled_date' => $note->scheduled_date?->toDateString(),
                'latitude' => $note->latitude !== null ? (float) $note->latitude : null,
                'longitude' => $note->longitude !== null ? (float) $note->longitude : null,
                // Needed to print a receipt at the door.
                'customer_name' => $note->customer_id
                    ? DB::table('customers')->where('id', $note->customer_id)->value('company_name')
                    : null,
                'items' => $note->items->map(fn ($item) => [
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                ])->values(),
            ])
            ->values();

        return Inertia::render('Distribution/Driver/Round', [
            'driver' => $this->driverPayload($driver),
            'notes' => $notes,
            'round' => $this->portal->todaysRound($driver),
        ]);
    }

    public function stock()
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        return Inertia::render('Distribution/Driver/Stock', [
            'driver' => $this->driverPayload($driver),
            'lines' => $this->portal->stockLines($driver),
            'summary' => $this->portal->stockSummary($driver),
        ]);
    }

    public function debts()
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        return Inertia::render('Distribution/Driver/Debts', [
            'driver' => $this->driverPayload($driver),
            'debtors' => $this->portal->receivables($driver),
            'summary' => $this->portal->receivablesSummary($driver),
        ]);
    }

    public function more()
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        return Inertia::render('Distribution/Driver/More', [
            'driver' => $this->driverPayload($driver),
        ]);
    }

    /** Paper size and print help; the choice itself lives on the device. */
    public function printer()
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        return Inertia::render('Distribution/Driver/Printer', [
            'driver' => $this->driverPayload($driver),
        ]);
    }

    /** The driver's own map: their stops and where they are. */
    public function map()
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        return Inertia::render('Distribution/Driver/Map', array_merge(
            $this->portal->mapData($driver),
            ['driver' => $this->driverPayload($driver)]
        ));
    }

    private function driverPayload(Driver $driver): array
    {
        return [
            'id' => $driver->id,
            'name' => $driver->name,
            'code' => $driver->code,
            'cash_balance' => (float) $driver->cash_balance,
            'allow_credit' => $driver->allow_credit,
        ];
    }

    /** Close out a stop: what was collected, and who received it. */
    public function completeNote(Request $request, DeliveryNote $note)
    {
        $driver = $this->currentDriver();

        if (!$driver || $note->driver_id !== $driver->user_id) {
            return redirect()->route('distribution.driver.access')->with('error', __('Permission denied'));
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in([
                DeliveryNote::STATUS_DELIVERED,
                DeliveryNote::STATUS_PARTIAL,
                DeliveryNote::STATUS_FAILED,
            ])],
            'collected_amount' => ['nullable', 'numeric', 'min:0', 'max:'.$note->total_amount],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'failure_reason' => ['nullable', 'string', 'max:2000'],
            'signature_data' => ['nullable', 'string'],
        ]);

        // Proof of delivery: the drawn signature arrives as a data URL and is
        // stored as a file, so the note keeps only a path.
        if (!empty($validated['signature_data'])) {
            $stored = upload_base64_file(
                $validated['signature_data'],
                'pod-'.$note->id.'-'.time(),
                'distribution/signatures'
            );

            // The helper reports success through `flag` and returns the stored
            // location as `url`.
            if (is_array($stored) && ($stored['flag'] ?? 0) === 1) {
                $note->update(['signature_path' => $stored['url']]);
            }
        }

        $this->drivers->completeDelivery($driver, $note, $validated);

        return back()->with('success', __('Delivery saved.'));
    }

    /** The driver's own view of what they owe the office. */
    public function startTransit(DeliveryNote $note)
    {
        $driver = $this->currentDriver();

        if (!$driver || $note->driver_id !== $driver->user_id) {
            return redirect()->route('distribution.driver.access')->with('error', __('Permission denied'));
        }

        if (in_array($note->status, DeliveryNote::OPEN_STATUSES, true)) {
            $note->update(['status' => DeliveryNote::STATUS_IN_TRANSIT]);
        }

        return back();
    }

    /**
     * A customer pays off what they still owe on past deliveries.
     *
     * The amount is checked against what this driver is actually owed by that
     * customer, so one driver cannot post a collection against another's notes
     * and a stale page cannot over-collect.
     */
    public function collectDebt(Request $request)
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        $validated = $request->validate([
            'customer_id' => ['required', 'integer'],
            'amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        $outstanding = $this->portal->customerOutstanding($driver, (int) $validated['customer_id']);

        if ($outstanding <= 0) {
            throw ValidationException::withMessages([
                'amount' => __('This customer owes you nothing.'),
            ]);
        }

        if ((float) $validated['amount'] > $outstanding) {
            throw ValidationException::withMessages([
                'amount' => __('That is more than this customer owes.'),
            ]);
        }

        $collected = $this->drivers->collectFromCustomer(
            $driver,
            (int) $validated['customer_id'],
            (float) $validated['amount']
        );

        return back()->with('success', __(':amount collected.', ['amount' => $collected]));
    }

    /** The driver hands their collected cash in to the office. */
    public function depositCash(Request $request)
    {
        $driver = $this->currentDriver();

        if (!$driver) {
            return redirect()->route('distribution.driver.access');
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01', 'max:'.$driver->cash_balance],
        ]);

        $this->drivers->depositCash($driver, (float) $validated['amount']);

        return back()->with('success', __('Cash handed in successfully.'));
    }

    private function currentDriver(): ?Driver
    {
        $userId = Auth::id();

        return $userId ? Driver::where('user_id', $userId)->first() : null;
    }
}
