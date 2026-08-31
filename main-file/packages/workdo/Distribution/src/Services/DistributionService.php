<?php

namespace Workdo\Distribution\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\DeliveryRound;

/**
 * Read models for the distribution screens.
 *
 * Every query is scoped by `created_by` (the owning company) - the module is
 * multi-tenant like the rest of the ERP, and nothing here may leak across
 * companies.
 */
class DistributionService
{
    /** Headline tiles on the Distribution hub. */
    public function dashboard(int $companyId): array
    {
        $today = Carbon::today();

        $roundsToday = DeliveryRound::where('created_by', $companyId)
            ->whereDate('round_date', $today)
            ->get();

        $notes = DeliveryNote::where('created_by', $companyId)->get();

        // Partials count as dropped: goods changed hands and cash was taken.
        // Excluding them here while `receivables` below counts them made the
        // same note mean two different things - a note delivered today with
        // 5 000 collected was missing from "today" yet present in "total".
        $deliveredToday = $notes
            ->whereIn('status', [DeliveryNote::STATUS_DELIVERED, DeliveryNote::STATUS_PARTIAL])
            ->filter(fn (DeliveryNote $note) => $note->delivered_at && $note->delivered_at->isSameDay($today));

        return [
            'summary' => [
                'rounds_today' => $roundsToday->count(),
                'rounds_completed' => $roundsToday->where('status', DeliveryRound::STATUS_COMPLETED)->count(),
                'notes_pending' => $notes->whereIn('status', DeliveryNote::OPEN_STATUSES)->count(),
                'delivered_today' => $deliveredToday->count(),
                'collected_today' => round((float) $deliveredToday->sum('collected_amount'), 2),
                'collected_total' => round((float) $notes->sum('collected_amount'), 2),
                'receivables' => round(
                    (float) $notes->whereIn('status', [DeliveryNote::STATUS_DELIVERED, DeliveryNote::STATUS_PARTIAL])
                        ->sum(fn (DeliveryNote $note) => (float) $note->total_amount - (float) $note->collected_amount),
                    2
                ),
                'active_drivers' => $this->drivers($companyId)->count(),
            ],
            'rounds_today' => $roundsToday
                ->map(fn (DeliveryRound $round) => $this->roundPayload($round))
                ->values(),
        ];
    }

    /**
     * Drivers available to distribution, each carrying the vehicle assigned
     * to them.
     *
     * A driver is a staff user, so this reuses the ERP's own user table rather
     * than introducing a parallel identity.
     *
     * The pairing is configured in fleet tracking, not here, so the round
     * planner can fill the vehicle in rather than asking for it twice - and can
     * say so when a driver has no vehicle to drive.
     *
     * Raw table access rather than a relation: `vehicles` and
     * `vehicle_assignments` belong to the FleetTracking package, which
     * Distribution must keep working without.
     */
    public function drivers(int $companyId): Collection
    {
        $assigned = DB::table('vehicle_assignments')
            ->join('vehicles', 'vehicles.id', '=', 'vehicle_assignments.vehicle_id')
            ->where('vehicle_assignments.created_by', $companyId)
            ->where('vehicle_assignments.status', 'active')
            // Newest wins if a driver somehow holds two active assignments.
            ->orderBy('vehicle_assignments.id')
            ->get(['vehicle_assignments.driver_id', 'vehicles.id as vehicle_id', 'vehicles.name as vehicle_name'])
            ->keyBy('driver_id');

        return User::where('created_by', $companyId)
            ->whereNotIn('type', ['client', 'vendor', 'company'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'mobile_no', 'type'])
            ->each(function (User $driver) use ($assigned) {
                $match = $assigned->get($driver->id);
                $driver->setAttribute('vehicle_id', $match->vehicle_id ?? null);
                $driver->setAttribute('vehicle_name', $match->vehicle_name ?? null);
            });
    }

    /** Driver list with the delivery counters the Livreurs screen shows. */
    public function driverStats(int $companyId): Collection
    {
        $notes = DeliveryNote::where('created_by', $companyId)->get()->groupBy('driver_id');

        return $this->drivers($companyId)->map(function (User $driver) use ($notes) {
            $own = $notes->get($driver->id, collect());
            $delivered = $own->where('status', DeliveryNote::STATUS_DELIVERED);

            return [
                'id' => $driver->id,
                'name' => $driver->name,
                'email' => $driver->email,
                'mobile_no' => $driver->mobile_no,
                'total' => $own->count(),
                'delivered' => $delivered->count(),
                'pending' => $own->whereIn('status', DeliveryNote::OPEN_STATUSES)->count(),
                'failed' => $own->where('status', DeliveryNote::STATUS_FAILED)->count(),
                'collected' => round((float) $delivered->sum('collected_amount'), 2),
                'success_rate' => $own->count() > 0
                    ? (int) round($delivered->count() / $own->count() * 100)
                    : 0,
            ];
        })->values();
    }

    /**
     * Driver performance over a trailing window.
     *
     * @param int $days Size of the window in days, counted back from today.
     */
    public function performance(int $companyId, int $days = 30): array
    {
        $since = Carbon::today()->subDays($days);

        $notes = DeliveryNote::where('created_by', $companyId)
            ->where('created_at', '>=', $since)
            ->get();

        $delivered = $notes->where('status', DeliveryNote::STATUS_DELIVERED);
        $rounds = DeliveryRound::where('created_by', $companyId)
            ->where('round_date', '>=', $since)
            ->get();

        $byStatus = $notes->groupBy('status')
            ->map(fn (Collection $group, string $status) => ['status' => $status, 'count' => $group->count()])
            ->values();

        return [
            'window_days' => $days,
            'totals' => [
                'deliveries' => $delivered->count(),
                'notes' => $notes->count(),
                'success_rate' => $notes->count() > 0
                    ? (int) round($delivered->count() / $notes->count() * 100)
                    : 0,
                'average_minutes' => $this->averageMinutes($delivered),
                'collected' => round((float) $delivered->sum('collected_amount'), 2),
                'billed' => round((float) $delivered->sum('total_amount'), 2),
                'rounds_total' => $rounds->count(),
                'rounds_completed' => $rounds->where('status', DeliveryRound::STATUS_COMPLETED)->count(),
            ],
            'by_status' => $byStatus,
            'ranking' => $this->driverStats($companyId)->sortByDesc('delivered')->values(),
        ];
    }



    /** Reference lists the delivery-note and round forms pick from. */
    public function formOptions(int $companyId): array
    {
        return [
            // The customer list, not `account.customers.create`: that route is
            // vestigial - its page component is a dialog body rendered by the
            // index, so on its own it throws "DialogPortal must be used within
            // Dialog". Resolved server-side and null when Account is absent,
            // since route() on a missing name throws in Ziggy and would take
            // the whole page down rather than just hiding a link.
            'customer_create_url' => Route::has('account.customers.index')
                ? route('account.customers.index')
                : null,
            'customers' => DB::table('customers')
                ->where('created_by', $companyId)
                ->orderBy('company_name')
                ->get(['id', 'company_name as name'])
                ->values(),
            'warehouses' => DB::table('warehouses')
                ->where('created_by', $companyId)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->values(),
            'products' => DB::table('product_service_items')
                ->where('created_by', $companyId)
                ->where('is_active', 1)
                ->orderBy('name')
                ->get(['id', 'name', 'sku', 'sale_price'])
                ->values(),
            'vehicles' => DB::table('vehicles')
                ->where('created_by', $companyId)
                ->orderBy('name')
                ->get(['id', 'name', 'plate_number'])
                ->values(),
        ];
    }

    /**
     * Everything plotted on the distribution map, as separate layers.
     *
     * Delivery notes carry their own snapshotted position; drivers come from
     * the fleet's last GPS ping; customers, warehouses and the head office are
     * fixed points. Any layer with no coordinates simply comes back empty
     * rather than being faked onto the map.
     */
    public function mapData(int $companyId): array
    {
        $notes = DeliveryNote::with('driver')
            ->where('created_by', $companyId)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get()
            ->map(fn (DeliveryNote $note) => [
                'id' => $note->id,
                'reference' => $note->reference,
                'status' => $note->status,
                'latitude' => (float) $note->latitude,
                'longitude' => (float) $note->longitude,
                'total_amount' => (float) $note->total_amount,
                'collected_amount' => (float) $note->collected_amount,
                'round_id' => $note->round_id,
                'driver' => $note->driver ? ['id' => $note->driver->id, 'name' => $note->driver->name] : null,
            ])
            ->values();

        // A driver's position is their vehicle's last ping, so only vehicles
        // with an assigned driver and a fix are shown.
        $drivers = DB::table('vehicles')
            ->where('vehicles.created_by', $companyId)
            ->whereNotNull('last_latitude')
            ->whereNotNull('last_longitude')
            ->leftJoin('vehicle_assignments', function ($join) {
                $join->on('vehicle_assignments.vehicle_id', '=', 'vehicles.id')
                    ->where('vehicle_assignments.status', '=', 'active');
            })
            ->leftJoin('users', 'users.id', '=', 'vehicle_assignments.driver_id')
            ->select(
                'vehicles.id',
                'vehicles.name',
                'vehicles.plate_number',
                'vehicles.last_latitude',
                'vehicles.last_longitude',
                'vehicles.last_ping_at',
                'users.id as driver_id',
                'users.name as driver_name'
            )
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => $row->name,
                'plate_number' => $row->plate_number,
                'latitude' => (float) $row->last_latitude,
                'longitude' => (float) $row->last_longitude,
                'last_ping_at' => $row->last_ping_at,
                'driver' => $row->driver_id ? ['id' => $row->driver_id, 'name' => $row->driver_name] : null,
            ])
            ->values();

        $customers = DB::table('customers')
            ->where('created_by', $companyId)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            // Customers are companies here, so the display name is
            // `company_name`; there is no `name` column on this table.
            ->get(['id', 'company_name', 'latitude', 'longitude'])
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => $row->company_name,
                'latitude' => (float) $row->latitude,
                'longitude' => (float) $row->longitude,
            ])
            ->values();

        $warehouses = DB::table('warehouses')
            ->where('created_by', $companyId)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get(['id', 'name', 'latitude', 'longitude'])
            ->map(fn ($row) => [
                'id' => $row->id,
                'name' => $row->name,
                'latitude' => (float) $row->latitude,
                'longitude' => (float) $row->longitude,
            ])
            ->values();

        return [
            'notes' => $notes,
            'drivers_on_map' => $drivers,
            'customers' => $customers,
            'warehouses' => $warehouses,
            'headquarters' => $this->headquarters($companyId),
            // Records with no coordinates yet, so the map can offer to place them.
            'unpinned' => DB::table('customers')
                ->where('created_by', $companyId)->whereNull('latitude')
                ->get(['id', 'company_name as name'])
                ->map(fn ($row) => ['id' => $row->id, 'name' => $row->name, 'type' => 'customer'])
                ->concat(
                    DB::table('warehouses')
                        ->where('created_by', $companyId)->whereNull('latitude')
                        ->get(['id', 'name'])
                        ->map(fn ($row) => ['id' => $row->id, 'name' => $row->name, 'type' => 'warehouse'])
                )
                ->values(),
            'rounds' => DeliveryRound::where('created_by', $companyId)
                ->orderByDesc('round_date')
                ->get(['id', 'reference'])
                ->map(fn (DeliveryRound $round) => [
                    'id' => $round->id,
                    'reference' => $round->reference ?? '#'.$round->id,
                ])
                ->values(),
        ];
    }

    /**
     * Head office position, held in company settings because there is only
     * one. Returns null when it has never been set, which the map reports as
     * "not defined" rather than dropping a pin at (0, 0).
     */
    private function headquarters(int $companyId): ?array
    {
        $settings = DB::table('settings')
            ->where('created_by', $companyId)
            ->whereIn('key', ['hq_latitude', 'hq_longitude'])
            ->pluck('value', 'key');

        $latitude = $settings['hq_latitude'] ?? null;
        $longitude = $settings['hq_longitude'] ?? null;

        if ($latitude === null || $longitude === null || $latitude === '' || $longitude === '') {
            return null;
        }

        return ['latitude' => (float) $latitude, 'longitude' => (float) $longitude];
    }

    /** Delivery notes plotted on the distribution map. */
    public function mapPoints(int $companyId): Collection
    {
        return DeliveryNote::with('driver')
            ->where('created_by', $companyId)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->get()
            ->map(fn (DeliveryNote $note) => [
                'id' => $note->id,
                'reference' => $note->reference,
                'status' => $note->status,
                'latitude' => (float) $note->latitude,
                'longitude' => (float) $note->longitude,
                'driver' => $note->driver ? ['id' => $note->driver->id, 'name' => $note->driver->name] : null,
            ])
            ->values();
    }

    /**
     * Mean minutes between a round starting and each of its notes being
     * delivered. Notes delivered outside a round have no start to measure from
     * and are skipped rather than counted as zero.
     */
    private function averageMinutes(Collection $delivered): int
    {
        $durations = $delivered
            ->load('round')
            ->map(function (DeliveryNote $note) {
                $start = $note->round?->started_at;
                if (!$start || !$note->delivered_at || $note->delivered_at->lessThan($start)) {
                    return null;
                }

                return $start->diffInMinutes($note->delivered_at);
            })
            ->filter(fn ($minutes) => $minutes !== null);

        return $durations->isEmpty() ? 0 : (int) round($durations->avg());
    }

    public function roundPayload(DeliveryRound $round): array
    {
        $notes = $round->relationLoaded('deliveryNotes') ? $round->deliveryNotes : $round->deliveryNotes()->get();

        return [
            'id' => $round->id,
            'reference' => $round->reference,
            'status' => $round->status,
            'round_date' => $round->round_date?->toDateString(),
            'started_at' => $round->started_at?->toIso8601String(),
            'completed_at' => $round->completed_at?->toIso8601String(),
            'driver' => $round->driver ? ['id' => $round->driver->id, 'name' => $round->driver->name] : null,
            'stops_total' => $notes->count(),
            'stops_done' => $notes->whereIn('status', [DeliveryNote::STATUS_DELIVERED, DeliveryNote::STATUS_PARTIAL])->count(),
            'collected' => round((float) $notes->sum('collected_amount'), 2),
        ];
    }
}
