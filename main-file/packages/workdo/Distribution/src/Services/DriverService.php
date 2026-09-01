<?php

namespace Workdo\Distribution\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Workdo\FleetTracking\Models\VehicleAssignment;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\Driver;
use Workdo\Distribution\Models\DriverCashMovement;

/**
 * Driver profiles: creation, codes, and the card payload the Drivers screen
 * renders.
 */
class DriverService
{
    /** Cards for the Drivers screen, with each driver's delivery counters. */
    public function cards(int $companyId): Collection
    {
        $notes = DeliveryNote::where('created_by', $companyId)->get()->groupBy('driver_id');

        return Driver::with('user')
            ->where('created_by', $companyId)
            ->orderBy('name')
            ->get()
            ->map(function (Driver $driver) use ($notes) {
                $own = $driver->user_id ? $notes->get($driver->user_id, collect()) : collect();
                $delivered = $own->where('status', DeliveryNote::STATUS_DELIVERED);

                return [
                    'id' => $driver->id,
                    'user_id' => $driver->user_id,
                    'name' => $driver->name,
                    'code' => $driver->code,
                    'phone' => $driver->phone,
                    'vehicle_label' => $driver->vehicle_label,
                    'vehicle_id' => VehicleAssignment::where('driver_id', $driver->user_id)
                        ->where('status', 'active')
                        ->value('vehicle_id'),
                    'access_code' => $driver->access_code,
                    'allow_credit' => $driver->allow_credit,
                    'max_discount_type' => $driver->max_discount_type,
                    'max_discount_value' => (float) $driver->max_discount_value,
                    'cash_balance' => (float) $driver->cash_balance,
                    'status' => $driver->status,
                    'total' => $own->count(),
                    'delivered' => $delivered->count(),
                    'pending' => $own->whereIn('status', DeliveryNote::OPEN_STATUSES)->count(),
                    'failed' => $own->where('status', DeliveryNote::STATUS_FAILED)->count(),
                    'collected' => round((float) $delivered->sum('collected_amount'), 2),
                    'success_rate' => $own->count() > 0
                        ? (int) round($delivered->count() / $own->count() * 100)
                        : 0,
                ];
            })
            ->values();
    }

    /**
     * Create a driver profile and the staff user behind it.
     *
     * The user is what delivery notes and the existing /livreur login hang
     * off, so both are written together or not at all.
     */
    public function create(array $data, int $companyId, int $creatorId): Driver
    {
        return DB::transaction(function () use ($data, $companyId, $creatorId) {
            $code = $data['code'] ?: $this->nextCode($companyId);
            $accessCode = $data['access_code'] ?: $this->nextAccessCode($companyId);

            $user = User::create([
                'name' => $data['name'],
                // Drivers sign in by phone and access code, not by email, but
                // the users table still needs one - so it is derived and kept
                // unique per company rather than collected from the form.
                'email' => $this->emailFor($code, $companyId),
                'password' => Hash::make($accessCode),
                'mobile_no' => $data['phone'] ?? null,
                'type' => 'staff',
                'email_verified_at' => now(),
                'created_by' => $companyId,
                'creator_id' => $creatorId,
                'is_enable_login' => 1,
            ]);

            // Without this the driver is refused by the fleet tracking
            // endpoints, so they could never start a session or send a ping.
            $this->grantTrackingPermission($user);

            $driver = Driver::create([
                'user_id' => $user->id,
                'name' => $data['name'],
                'code' => $code,
                'phone' => $data['phone'] ?? null,
                'vehicle_label' => $data['vehicle_label'] ?? null,
                'access_code' => $accessCode,
                'allow_credit' => $data['allow_credit'] ?? true,
                'max_discount_type' => $data['max_discount_type'] ?? Driver::DISCOUNT_PERCENT,
                'max_discount_value' => $data['max_discount_value'] ?? 0,
                'status' => Driver::STATUS_ACTIVE,
                'creator_id' => $creatorId,
                'created_by' => $companyId,
            ]);

            $this->assignVehicle($driver, isset($data['vehicle_id']) ? (int) $data['vehicle_id'] : null);

            return $driver;
        });
    }


    /**
     * Let the driver record their own location.
     *
     * Fleet tracking gates `startSession` and `pings.store` on this, so a
     * distribution driver without it is invisible on the map no matter what
     * they do on their phone.
     */
    public function grantTrackingPermission(User $user): void
    {
        $permission = Permission::firstOrCreate(
            ['name' => 'track-own-location', 'guard_name' => 'web'],
            ['module' => 'fleet-tracking', 'label' => 'Track Own Location', 'add_on' => 'FleetTracking']
        );

        if (!$user->hasPermissionTo($permission)) {
            $user->givePermissionTo($permission);
        }
    }

    /**
     * Point the driver at a fleet vehicle.
     *
     * The tracking session hangs off an active vehicle assignment, and a
     * driver may only be on one vehicle at a time, so any previous assignment
     * is closed first.
     */
    public function assignVehicle(Driver $driver, ?int $vehicleId): void
    {
        if (!$driver->user_id) {
            return;
        }

        DB::transaction(function () use ($driver, $vehicleId) {
            VehicleAssignment::where('driver_id', $driver->user_id)
                ->where('status', 'active')
                ->update(['status' => 'completed', 'ends_at' => now()]);

            if (!$vehicleId) {
                return;
            }

            VehicleAssignment::create([
                'vehicle_id' => $vehicleId,
                'driver_id' => $driver->user_id,
                'starts_at' => now(),
                'status' => 'active',
                'creator_id' => $driver->creator_id,
                'created_by' => $driver->created_by,
            ]);
        });
    }

    public function update(Driver $driver, array $data): Driver
    {
        return DB::transaction(function () use ($driver, $data) {
            $driver->update([
                'name' => $data['name'],
                'phone' => $data['phone'] ?? null,
                'vehicle_label' => $data['vehicle_label'] ?? null,
                'allow_credit' => $data['allow_credit'] ?? true,
                'max_discount_type' => $data['max_discount_type'] ?? Driver::DISCOUNT_PERCENT,
                'max_discount_value' => $data['max_discount_value'] ?? 0,
                'status' => $data['status'] ?? $driver->status,
            ]);

            $driver->user?->update([
                'name' => $data['name'],
                'mobile_no' => $data['phone'] ?? null,
            ]);

            if (array_key_exists('vehicle_id', $data)) {
                $this->assignVehicle($driver, $data['vehicle_id'] ? (int) $data['vehicle_id'] : null);
            }

            return $driver->refresh();
        });
    }

    /** Issue a fresh access code, keeping the login password in step. */
    public function regenerateAccessCode(Driver $driver): Driver
    {
        return DB::transaction(function () use ($driver) {
            $accessCode = $this->nextAccessCode((int) $driver->created_by);

            $driver->update(['access_code' => $accessCode]);
            $driver->user?->update(['password' => Hash::make($accessCode)]);

            return $driver->refresh();
        });
    }

    public function delete(Driver $driver): void
    {
        DB::transaction(function () use ($driver) {
            // The user stays if delivery notes still reference it; orphaning
            // past deliveries would lose who made them.
            $hasHistory = $driver->user_id
                && DeliveryNote::where('driver_id', $driver->user_id)->exists();

            $user = $driver->user;
            $driver->delete();

            if ($user && !$hasHistory) {
                $user->delete();
            }
        });
    }


    /**
     * Close out a delivery and move the money.
     *
     * Whatever the driver collects at the door lands in their own cash box,
     * which is what they later settle with the office. The note and the
     * balance move together so a recorded collection can never go missing
     * from the balance.
     */
    public function completeDelivery(Driver $driver, DeliveryNote $note, array $data): DeliveryNote
    {
        return DB::transaction(function () use ($driver, $note, $data) {
            $previousStatus = $note->status;
            $collected = (float) ($data['collected_amount'] ?? 0);

            // A failed delivery hands nothing over, whatever was submitted.
            if ($data['status'] === DeliveryNote::STATUS_FAILED) {
                $collected = 0.0;
            }

            // Re-completing a note adjusts by the difference rather than
            // adding the whole amount a second time.
            $delta = $collected - (float) $note->collected_amount;

            $note->update([
                'status' => $data['status'],
                'collected_amount' => $collected,
                'recipient_name' => $data['recipient_name'] ?? $note->recipient_name,
                'failure_reason' => $data['failure_reason'] ?? null,
                'delivered_at' => $data['status'] === DeliveryNote::STATUS_FAILED ? null : now(),
            ]);

            // Goods leave the warehouse when the delivery actually lands, and
            // come back if it is later reopened as failed.
            app(DeliveryNoteService::class)->applyStockForStatus($note, $previousStatus, $data['status']);

            if ($delta !== 0.0) {
                $this->adjustCash($driver, $delta, 'collection', $note->id);
            }

            return $note->refresh();
        });
    }

    /**
     * Cash handed in by the driver themselves.
     *
     * The same movement as an office settlement - only the initiator differs,
     * which the ledger already records through `creator_id`.
     */
    /**
     * Record money a customer pays after the delivery already happened.
     *
     * Allocated oldest note first and written as one cash movement per note,
     * so the driver's balance and the audit trail stay tied to the deliveries
     * the money actually settles rather than to a floating lump sum.
     *
     * The note's status is deliberately left alone: it describes how the
     * delivery went, not whether it has been paid for. A partial delivery that
     * is later paid in full is still a partial delivery.
     *
     * @return float the amount actually allocated, which is less than $amount
     *               only if the debt shrank between the page load and the post
     */
    public function collectFromCustomer(Driver $driver, int $customerId, float $amount): float
    {
        return DB::transaction(function () use ($driver, $customerId, $amount) {
            $notes = DeliveryNote::where('driver_id', $driver->user_id)
                ->where('customer_id', $customerId)
                ->whereIn('status', [DeliveryNote::STATUS_DELIVERED, DeliveryNote::STATUS_PARTIAL])
                ->whereColumn('collected_amount', '<', 'total_amount')
                ->orderBy('scheduled_date')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $remaining = round($amount, 2);
            $allocated = 0.0;

            foreach ($notes as $note) {
                if ($remaining <= 0) {
                    break;
                }

                $outstanding = round((float) $note->total_amount - (float) $note->collected_amount, 2);

                if ($outstanding <= 0) {
                    continue;
                }

                $part = min($outstanding, $remaining);

                $note->update([
                    'collected_amount' => round((float) $note->collected_amount + $part, 2),
                ]);

                $this->adjustCash($driver, $part, DriverCashMovement::TYPE_COLLECTION, $note->id);

                $remaining = round($remaining - $part, 2);
                $allocated = round($allocated + $part, 2);
            }

            return $allocated;
        });
    }

    public function depositCash(Driver $driver, float $amount): Driver
    {
        return $this->settleCash($driver, $amount);
    }

    /**
     * Hand cash in to the office.
     *
     * @param float $amount Amount remitted; must not exceed what is held.
     */
    public function settleCash(Driver $driver, float $amount): Driver
    {
        return DB::transaction(function () use ($driver, $amount) {
            $held = (float) $driver->fresh()->cash_balance;
            $settled = min($amount, $held);

            if ($settled > 0) {
                $this->adjustCash($driver, -$settled, 'settlement');
            }

            return $driver->refresh();
        });
    }

    /**
     * Move the driver's balance and write the movement to the ledger.
     *
     * The row is locked so concurrent collections cannot lose an update, and
     * every change is recorded - a cash balance nobody can audit is worse than
     * no balance at all.
     *
     * @param string   $type          "collection" or "settlement".
     * @param int|null $deliveryNoteId The note the cash came from, when there is one.
     */
    private function adjustCash(Driver $driver, float $delta, string $type, ?int $deliveryNoteId = null): void
    {
        $locked = Driver::whereKey($driver->id)->lockForUpdate()->first();

        if (!$locked) {
            return;
        }

        $balance = round((float) $locked->cash_balance + $delta, 2);
        $locked->update(['cash_balance' => $balance]);

        DriverCashMovement::create([
            'driver_id' => $locked->id,
            'delivery_note_id' => $deliveryNoteId,
            'type' => $type,
            'amount' => round($delta, 2),
            'balance_after' => $balance,
            'creator_id' => auth()->id(),
            'created_by' => $locked->created_by,
        ]);
    }

    /** Sequential per-company code, e.g. LIV-001. */
    public function nextCode(int $companyId): string
    {
        $last = Driver::where('created_by', $companyId)
            ->where('code', 'like', 'LIV-%')
            ->orderByDesc('id')
            ->value('code');

        $next = $last ? ((int) Str::afterLast($last, '-')) + 1 : 1;

        return 'LIV-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    /** Six digits, unique within the company so a login is unambiguous. */
    public function nextAccessCode(int $companyId): string
    {
        do {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (Driver::where('created_by', $companyId)->where('access_code', $code)->exists());

        return $code;
    }

    private function emailFor(string $code, int $companyId): string
    {
        return Str::lower(Str::slug($code)).'.'.$companyId.'@livreur.local';
    }
}
