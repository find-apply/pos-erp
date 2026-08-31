<?php

namespace Workdo\Distribution\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;
use Illuminate\Validation\Rule;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\DeliveryRound;
use Workdo\Distribution\Models\Driver;
use Workdo\Distribution\Services\DeliveryNoteService;
use Workdo\Distribution\Services\DeliveryRoundService;
use Workdo\Distribution\Services\DistributionService;
use Workdo\Distribution\Services\DriverService;
use Workdo\Distribution\Services\VanLoadingService;

class DistributionController extends Controller
{
    public function __construct(
        private DistributionService $distribution,
        private DriverService $drivers,
        private DeliveryNoteService $notes,
        private DeliveryRoundService $roundService,
        private VanLoadingService $vanLoading,
    ) {
    }

    /** The hub: today's numbers plus the shortcut grid. */
    public function index()
    {
        if ($denied = $this->deny('view-distribution')) {
            return $denied;
        }

        return Inertia::render('Distribution/Index', $this->distribution->dashboard(creatorId()));
    }

    public function drivers()
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }

        return Inertia::render('Distribution/Drivers', array_merge(
            $this->distribution->formOptions(creatorId()),
            [
                'drivers' => $this->drivers->cards(creatorId()),
                'next_code' => $this->drivers->nextCode(creatorId()),
                'next_access_code' => $this->drivers->nextAccessCode(creatorId()),
            ]
        ));
    }

    public function storeDriver(Request $request)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }

        $validated = $request->validate($this->driverRules());

        $this->drivers->create($validated, creatorId(), Auth::id());

        return back()->with('success', __('Driver created successfully.'));
    }

    public function updateDriver(Request $request, Driver $driver)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }
        if ($denied = $this->denyForeign($driver)) {
            return $denied;
        }

        $validated = $request->validate($this->driverRules($driver));

        $this->drivers->update($driver, $validated);

        return back()->with('success', __('Driver updated successfully.'));
    }

    public function regenerateDriverCode(Driver $driver)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }
        if ($denied = $this->denyForeign($driver)) {
            return $denied;
        }

        $this->drivers->regenerateAccessCode($driver);

        return back()->with('success', __('Access code regenerated.'));
    }

    public function destroyDriver(Driver $driver)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }
        if ($denied = $this->denyForeign($driver)) {
            return $denied;
        }

        $this->drivers->delete($driver);

        return back()->with('success', __('Driver deleted successfully.'));
    }

    public function settleDriverCash(Request $request, Driver $driver)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }
        if ($denied = $this->denyForeign($driver)) {
            return $denied;
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        $this->drivers->settleCash($driver, (float) $validated['amount']);

        return back()->with('success', __('Cash settled.'));
    }


    public function storeDeliveryNote(Request $request)
    {
        if ($denied = $this->deny('manage-delivery-notes')) {
            return $denied;
        }

        $this->notes->create($request->validate($this->noteRules()), creatorId(), Auth::id());

        return back()->with('success', __('Delivery note created successfully.'));
    }

    public function updateDeliveryNote(Request $request, DeliveryNote $note)
    {
        if ($denied = $this->deny('manage-delivery-notes')) {
            return $denied;
        }
        if ($denied = $this->denyForeignModel($note)) {
            return $denied;
        }

        $this->notes->update($note, $request->validate($this->noteRules()));

        return back()->with('success', __('Delivery note updated successfully.'));
    }

    public function destroyDeliveryNote(DeliveryNote $note)
    {
        if ($denied = $this->deny('manage-delivery-notes')) {
            return $denied;
        }
        if ($denied = $this->denyForeignModel($note)) {
            return $denied;
        }

        $this->notes->delete($note);

        return back()->with('success', __('Delivery note deleted successfully.'));
    }

    public function storeRound(Request $request)
    {
        if ($denied = $this->deny('manage-delivery-rounds')) {
            return $denied;
        }

        $this->roundService->create($request->validate($this->roundRules()), creatorId(), Auth::id());

        return back()->with('success', __('Round created successfully.'));
    }

    public function updateRound(Request $request, DeliveryRound $round)
    {
        if ($denied = $this->deny('manage-delivery-rounds')) {
            return $denied;
        }
        if ($denied = $this->denyForeignModel($round)) {
            return $denied;
        }

        $this->roundService->update($round, $request->validate($this->roundRules()));

        return back()->with('success', __('Round updated successfully.'));
    }

    /** Move a round through its lifecycle: start, complete or cancel. */
    public function transitionRound(Request $request, DeliveryRound $round)
    {
        if ($denied = $this->deny('manage-delivery-rounds')) {
            return $denied;
        }
        if ($denied = $this->denyForeignModel($round)) {
            return $denied;
        }

        $validated = $request->validate([
            'action' => ['required', Rule::in(['start', 'complete', 'cancel'])],
        ]);

        match ($validated['action']) {
            'start' => $this->roundService->start($round),
            'complete' => $this->roundService->complete($round),
            'cancel' => $this->roundService->cancel($round),
        };

        return back()->with('success', __('Round updated successfully.'));
    }

    public function destroyRound(DeliveryRound $round)
    {
        if ($denied = $this->deny('manage-delivery-rounds')) {
            return $denied;
        }
        if ($denied = $this->denyForeignModel($round)) {
            return $denied;
        }

        $this->roundService->delete($round);

        return back()->with('success', __('Round deleted successfully.'));
    }

    /**
     * Sign in as one of the company's own drivers to see their portal.
     *
     * Reuses the ERP's existing impersonation session key, so the "Leave login
     * as user" control already in the header ends this the same way it ends
     * any other impersonation.
     */
    public function impersonateDriver(Driver $driver)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }
        if ($denied = $this->denyForeign($driver)) {
            return $denied;
        }

        if (!$driver->user) {
            return back()->with('error', __('This driver has no login account.'));
        }

        if ($driver->status !== Driver::STATUS_ACTIVE) {
            return back()->with('error', __('This driver is not active.'));
        }

        // Only ever step *down* into a driver - never overwrite an existing
        // impersonation, which would strand whoever started it.
        if (!Session::has('impersonator_id')) {
            Session::put('impersonator_id', Auth::id());
        }

        Auth::login($driver->user);

        return redirect()->route('distribution.driver.home')
            ->with('success', __('You are now login as user :name', ['name' => $driver->name]));
    }

    /** Load stock from a warehouse onto a driver's vehicle. */
    public function loadVan(Request $request, Driver $driver)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }
        if ($denied = $this->denyForeign($driver)) {
            return $denied;
        }

        $validated = $request->validate($this->vanRules());

        $result = $this->vanLoading->load(
            $driver,
            (int) $validated['warehouse_id'],
            $validated['items'],
            Auth::id()
        );

        if ($result['short']) {
            return back()->with(
                'error',
                __(':count line(s) could not be fully loaded - the warehouse is short.', ['count' => count($result['short'])])
            );
        }

        return back()->with('success', __('Vehicle loaded successfully.'));
    }

    /** Return stock from the vehicle to a warehouse. */
    public function unloadVan(Request $request, Driver $driver)
    {
        if ($denied = $this->deny('manage-distribution-drivers')) {
            return $denied;
        }
        if ($denied = $this->denyForeign($driver)) {
            return $denied;
        }

        $validated = $request->validate($this->vanRules());

        $this->vanLoading->unload($driver, (int) $validated['warehouse_id'], $validated['items'], Auth::id());

        return back()->with('success', __('Vehicle unloaded successfully.'));
    }

    /**
     * Pin a customer, a warehouse or the head office on the map.
     *
     * These are the coordinates the distribution map plots; without them a
     * layer simply has nothing to show.
     */
    public function savePin(Request $request)
    {
        if ($denied = $this->deny('view-distribution-map')) {
            return $denied;
        }

        $validated = $request->validate([
            'type' => ['required', Rule::in(['customer', 'warehouse', 'headquarters'])],
            'id' => ['nullable', 'integer'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $company = creatorId();

        match ($validated['type']) {
            // Scoped by company so a guessed id cannot move another tenant's pin.
            'customer' => DB::table('customers')
                ->where('id', $validated['id'])->where('created_by', $company)
                ->update(['latitude' => $validated['latitude'], 'longitude' => $validated['longitude']]),
            'warehouse' => DB::table('warehouses')
                ->where('id', $validated['id'])->where('created_by', $company)
                ->update(['latitude' => $validated['latitude'], 'longitude' => $validated['longitude']]),
            'headquarters' => $this->saveHeadquarters($company, (float) $validated['latitude'], (float) $validated['longitude']),
        };

        return back()->with('success', __('Location saved.'));
    }

    private function saveHeadquarters(int $company, float $latitude, float $longitude): void
    {
        foreach (['hq_latitude' => $latitude, 'hq_longitude' => $longitude] as $key => $value) {
            DB::table('settings')->updateOrInsert(
                ['created_by' => $company, 'key' => $key],
                ['value' => (string) $value, 'updated_at' => now(), 'created_at' => now()]
            );
        }
    }

    private function vanRules(): array
    {
        $company = creatorId();

        return [
            'warehouse_id' => ['required', 'integer', Rule::exists('warehouses', 'id')->where('created_by', $company)],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('product_service_items', 'id')->where('created_by', $company)],
            'items.*.quantity' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Notes that can still be put on a round: unfinished, and either free or
     * already on the round being edited.
     *
     * Carries who the stop is for and what is on it - a bare reference gives a
     * planner nothing to sequence by. Customer names come from a keyed query
     * rather than a relation: `customers` belongs to the Account package, and
     * Distribution must not fall over when that package is disabled.
     */
    private function assignableNotes(int $companyId)
    {
        $notes = DeliveryNote::with('items:id,delivery_note_id,description,quantity')
            ->where('created_by', $companyId)
            ->whereIn('status', DeliveryNote::OPEN_STATUSES)
            ->orderBy('scheduled_date')
            ->get();

        $customers = DB::table('customers')
            ->whereIn('id', $notes->pluck('customer_id')->filter()->unique())
            ->pluck('company_name', 'id');

        return $notes->map(fn (DeliveryNote $note) => [
            'id' => $note->id,
            'reference' => $note->reference ?? '#'.$note->id,
            'round_id' => $note->round_id,
            'total_amount' => (float) $note->total_amount,
            'customer_name' => $customers[$note->customer_id] ?? null,
            'items_count' => $note->items->count(),
            'items_summary' => $note->items
                ->take(3)
                ->map(fn ($item) => ((float) $item->quantity).'× '.($item->description ?: '-'))
                ->implode(', '),
        ])->values();
    }

    private function noteRules(): array
    {
        $company = creatorId();

        return [
            'reference' => ['nullable', 'string', 'max:60'],
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('created_by', $company)],
            'warehouse_id' => ['nullable', 'integer', Rule::exists('warehouses', 'id')->where('created_by', $company)],
            'driver_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('created_by', $company)],
            'round_id' => ['nullable', 'integer', Rule::exists('delivery_rounds', 'id')->where('created_by', $company)],
            'scheduled_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['array'],
            'items.*.product_id' => ['nullable', 'integer', Rule::exists('product_service_items', 'id')->where('created_by', $company)],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'min:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ];
    }

    private function roundRules(): array
    {
        $company = creatorId();

        return [
            'reference' => ['nullable', 'string', 'max:60'],
            // A round with no driver cannot be driven and one with no date
            // cannot be scheduled; both were nullable, so a blank round saved.
            'driver_id' => ['required', 'integer', Rule::exists('users', 'id')->where('created_by', $company)],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where('created_by', $company)],
            'warehouse_id' => ['nullable', 'integer', Rule::exists('warehouses', 'id')->where('created_by', $company)],
            'round_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'note_ids' => ['array'],
            'note_ids.*' => ['integer', Rule::exists('delivery_notes', 'id')->where('created_by', $company)],
        ];
    }

    /** Blocks acting on another company's record via a guessed id. */
    private function denyForeignModel($model)
    {
        if ((int) $model->created_by !== creatorId()) {
            return redirect()->route('distribution.index')->with('error', __('Permission denied'));
        }

        return null;
    }

    /**
     * @param Driver|null $driver The row being edited, excluded from the
     *                            uniqueness checks so saving it unchanged works.
     */
    private function driverRules(?Driver $driver = null): array
    {
        $company = creatorId();

        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:40'],
            'code' => [
                'nullable', 'string', 'max:40',
                Rule::unique('distribution_drivers', 'code')
                    ->where('created_by', $company)
                    ->ignore($driver?->id),
            ],
            'access_code' => [
                'nullable', 'string', 'digits:6',
                Rule::unique('distribution_drivers', 'access_code')
                    ->where('created_by', $company)
                    ->ignore($driver?->id),
            ],
            'vehicle_label' => ['nullable', 'string', 'max:255'],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where('created_by', $company)],
            'allow_credit' => ['boolean'],
            'max_discount_type' => ['required', Rule::in([Driver::DISCOUNT_PERCENT, Driver::DISCOUNT_AMOUNT])],
            'max_discount_value' => ['numeric', 'min:0'],
            'status' => ['nullable', Rule::in([Driver::STATUS_ACTIVE, Driver::STATUS_INACTIVE])],
        ];
    }

    /** Guards against acting on another company's driver via a guessed id. */
    private function denyForeign(Driver $driver)
    {
        if ((int) $driver->created_by !== creatorId()) {
            return redirect()->route('distribution.drivers')->with('error', __('Permission denied'));
        }

        return null;
    }

    public function rounds(Request $request)
    {
        if ($denied = $this->deny('manage-delivery-rounds')) {
            return $denied;
        }

        $status = $request->query('status');

        $rounds = DeliveryRound::with(['driver', 'deliveryNotes'])
            ->where('created_by', creatorId())
            ->when($status, fn ($query) => $query->where('status', $status))
            ->orderByDesc('round_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (DeliveryRound $round) => $this->distribution->roundPayload($round))
            ->values();

        return Inertia::render('Distribution/Rounds', array_merge(
            $this->distribution->formOptions(creatorId()),
            [
                'rounds' => $rounds,
                'drivers' => $this->distribution->drivers(creatorId()),
                'filters' => ['status' => $status],
                'next_reference' => $this->roundService->nextReference(creatorId()),
                // A stop can be created without leaving the round planner, so
                // the note dialog's own next reference is needed here too.
                'next_note_reference' => $this->notes->nextReference(creatorId()),
                // Notes that can still be put on a round: unfinished, and
                // either free or already on the round being edited.
                'assignable_notes' => $this->assignableNotes(creatorId()),
            ]
        ));
    }

    public function deliveryNotes(Request $request)
    {
        if ($denied = $this->deny('manage-delivery-notes')) {
            return $denied;
        }

        $status = $request->query('status');

        $notes = DeliveryNote::with(['driver', 'round', 'items'])
            ->where('created_by', creatorId())
            ->when($status, fn ($query) => $query->where('status', $status))
            ->orderByDesc('scheduled_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (DeliveryNote $note) => [
                'id' => $note->id,
                'reference' => $note->reference,
                'status' => $note->status,
                'scheduled_date' => $note->scheduled_date?->toDateString(),
                'delivered_at' => $note->delivered_at?->toIso8601String(),
                'total_amount' => (float) $note->total_amount,
                'collected_amount' => (float) $note->collected_amount,
                'customer_id' => $note->customer_id,
                'warehouse_id' => $note->warehouse_id,
                'round_id' => $note->round_id,
                'notes' => $note->notes,
                'driver' => $note->driver ? ['id' => $note->driver->id, 'name' => $note->driver->name] : null,
                'round' => $note->round ? ['id' => $note->round->id, 'reference' => $note->round->reference] : null,
                'items' => $note->items->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                ])->values(),
            ])
            ->values();

        return Inertia::render('Distribution/DeliveryNotes', array_merge(
            $this->distribution->formOptions(creatorId()),
            [
                'notes' => $notes,
                'filters' => ['status' => $status],
                'drivers' => $this->distribution->drivers(creatorId()),
                'rounds' => DeliveryRound::where('created_by', creatorId())
                    ->orderByDesc('round_date')
                    ->get(['id', 'reference'])
                    ->values(),
                'next_reference' => $this->notes->nextReference(creatorId()),
            ]
        ));
    }

    public function map()
    {
        if ($denied = $this->deny('view-distribution-map')) {
            return $denied;
        }

        return Inertia::render('Distribution/Map', array_merge(
            $this->distribution->mapData(creatorId()),
            ['drivers' => $this->distribution->drivers(creatorId())]
        ));
    }

    public function performance(Request $request)
    {
        if ($denied = $this->deny('view-distribution-performance')) {
            return $denied;
        }

        // Only a fixed set of windows, so the value cannot be used to widen the
        // query beyond what the filter offers.
        $days = (int) $request->query('days', 30);
        $days = in_array($days, [7, 30, 90], true) ? $days : 30;

        return Inertia::render('Distribution/Performance', $this->distribution->performance(creatorId(), $days));
    }

    /**
     * Distribution-wide gate. `manage-distribution` is the module-level
     * permission and always passes; otherwise the screen's own is required.
     */
    private function deny(string $permission)
    {
        $user = Auth::user();

        if ($user->can('manage-distribution') || $user->can($permission)) {
            return null;
        }

        return redirect()->route('dashboard')->with('error', __('Permission denied'));
    }
}
