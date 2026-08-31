<?php

namespace Workdo\Distribution\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\DeliveryRound;
use Workdo\Distribution\Models\Driver;

/**
 * What a driver sees on their own phone.
 *
 * Everything is scoped to the signed-in driver - a driver may only ever see
 * their own round, their own van stock and the customers they are owed by.
 */
class DriverPortalService
{
    /** Tiles and today's round on the driver home screen. */
    public function dashboard(Driver $driver): array
    {
        return [
            'stock' => $this->stockSummary($driver),
            'cash_balance' => (float) $driver->cash_balance,
            'receivables' => $this->receivablesSummary($driver),
            'round' => $this->todaysRound($driver),
        ];
    }

    /** Value and line count of what the driver is carrying. */
    public function stockSummary(Driver $driver): array
    {
        $lines = $this->stockLines($driver);

        return [
            'items' => $lines->count(),
            'value' => round((float) $lines->sum('value'), 2),
        ];
    }

    /**
     * Van stock, priced at the catalogue sale price.
     *
     * @return Collection<int, array{product_id: int, name: string, sku: string|null, quantity: float, unit_price: float, value: float}>
     */
    public function stockLines(Driver $driver): Collection
    {
        return DB::table('driver_stocks')
            ->where('driver_stocks.driver_id', $driver->id)
            ->where('driver_stocks.quantity', '>', 0)
            ->leftJoin('product_service_items', 'product_service_items.id', '=', 'driver_stocks.product_id')
            ->orderBy('product_service_items.name')
            ->get([
                'driver_stocks.product_id',
                'driver_stocks.quantity',
                'product_service_items.name',
                'product_service_items.sku',
                'product_service_items.sale_price',
            ])
            ->map(fn ($row) => [
                'product_id' => (int) $row->product_id,
                'name' => $row->name ?? '-',
                'sku' => $row->sku,
                'quantity' => (float) $row->quantity,
                'unit_price' => (float) ($row->sale_price ?? 0),
                'value' => round((float) $row->quantity * (float) ($row->sale_price ?? 0), 2),
            ])
            ->values();
    }

    /** Headline figures for the debts screen. */
    public function receivablesSummary(Driver $driver): array
    {
        $debts = $this->receivables($driver);

        return [
            'customers' => $debts->count(),
            'total' => round((float) $debts->sum('debt'), 2),
        ];
    }

    /**
     * What each customer still owes on deliveries this driver made.
     *
     * Derived rather than stored: a debt is simply what was billed on a
     * delivered note and not collected at the door.
     */
    public function receivables(Driver $driver): Collection
    {
        return DeliveryNote::where('driver_id', $driver->user_id)
            ->whereIn('status', [DeliveryNote::STATUS_DELIVERED, DeliveryNote::STATUS_PARTIAL])
            ->selectRaw('customer_id, SUM(total_amount - collected_amount) as debt, COUNT(*) as notes')
            ->groupBy('customer_id')
            ->havingRaw('debt > 0')
            ->get()
            ->map(function ($row) {
                $customer = DB::table('customers')->where('id', $row->customer_id)->first(['company_name']);

                return [
                    'customer_id' => (int) $row->customer_id,
                    'name' => $customer->company_name ?? '-',
                    'debt' => round((float) $row->debt, 2),
                    'notes' => (int) $row->notes,
                ];
            })
            ->sortByDesc('debt')
            ->values();
    }

    /** The round the driver is on today, if any. */
    public function todaysRound(Driver $driver): ?array
    {
        $round = DeliveryRound::with('deliveryNotes')
            ->where('driver_id', $driver->user_id)
            ->whereDate('round_date', today())
            ->first();

        if (!$round) {
            return null;
        }

        $notes = $round->deliveryNotes;

        return [
            'id' => $round->id,
            'reference' => $round->reference ?? '#'.$round->id,
            'status' => $round->status,
            'stops_total' => $notes->count(),
            'stops_done' => $notes->whereIn('status', [
                DeliveryNote::STATUS_DELIVERED,
                DeliveryNote::STATUS_PARTIAL,
                DeliveryNote::STATUS_FAILED,
            ])->count(),
        ];
    }


    /**
     * What the driver needs on their own map: their stops, where they are, and
     * the warehouses they can return to.
     *
     * Deliberately narrower than the office map - a driver sees their own
     * round, not the whole fleet.
     */
    public function mapData(Driver $driver): array
    {
        $stops = DeliveryNote::where('driver_id', $driver->user_id)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderBy('sequence')
            ->get()
            ->map(fn (DeliveryNote $note) => [
                'id' => $note->id,
                'reference' => $note->reference ?? '#'.$note->id,
                'status' => $note->status,
                'sequence' => (int) $note->sequence,
                'latitude' => (float) $note->latitude,
                'longitude' => (float) $note->longitude,
                'total_amount' => (float) $note->total_amount,
            ])
            ->values();

        // The driver's own position is their vehicle's last fix.
        $vehicle = DB::table('vehicles')
            ->join('vehicle_assignments', function ($join) use ($driver) {
                $join->on('vehicle_assignments.vehicle_id', '=', 'vehicles.id')
                    ->where('vehicle_assignments.driver_id', '=', $driver->user_id)
                    ->where('vehicle_assignments.status', '=', 'active');
            })
            ->whereNotNull('vehicles.last_latitude')
            ->first(['vehicles.name', 'vehicles.plate_number', 'vehicles.last_latitude', 'vehicles.last_longitude', 'vehicles.last_ping_at']);

        return [
            'stops' => $stops,
            'me' => $vehicle ? [
                'name' => $vehicle->name,
                'plate_number' => $vehicle->plate_number,
                'latitude' => (float) $vehicle->last_latitude,
                'longitude' => (float) $vehicle->last_longitude,
                'last_ping_at' => $vehicle->last_ping_at,
            ] : null,
            'warehouses' => DB::table('warehouses')
                ->where('created_by', $driver->created_by)
                ->whereNotNull('latitude')
                ->get(['id', 'name', 'latitude', 'longitude'])
                ->map(fn ($row) => [
                    'id' => $row->id,
                    'name' => $row->name,
                    'latitude' => (float) $row->latitude,
                    'longitude' => (float) $row->longitude,
                ])
                ->values(),
        ];
    }

    /** Customers this driver can sell to - the company's whole book. */
    public function customers(Driver $driver): Collection
    {
        return DB::table('customers')
            ->where('created_by', $driver->created_by)
            ->orderBy('company_name')
            ->get(['id', 'company_name as name', 'contact_person_mobile as phone', 'latitude', 'longitude'])
            ->values();
    }
}
