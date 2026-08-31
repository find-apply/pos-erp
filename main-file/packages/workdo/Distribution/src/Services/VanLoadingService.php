<?php

namespace Workdo\Distribution\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Workdo\Distribution\Models\Driver;
use Workdo\Distribution\Models\DriverStock;
use Workdo\Distribution\Models\DriverStockMovement;
use Workdo\ProductService\Models\WarehouseStock;

/**
 * Moving stock between a warehouse and a driver's vehicle.
 *
 * This is the only way goods get onto a van. Both sides of every move happen
 * in one transaction so the total across warehouse and van is conserved -
 * stock is never created or destroyed here, only relocated.
 */
class VanLoadingService
{
    /**
     * Load stock from a warehouse onto a driver's vehicle.
     *
     * @param array<int, array{product_id: int, quantity: float}> $items
     *
     * @return array{loaded: int, short: array<int, array{product_id: int, requested: float, available: float}>}
     *         `short` lists lines the warehouse could not fully cover.
     */
    public function load(Driver $driver, int $warehouseId, array $items, int $creatorId): array
    {
        return DB::transaction(function () use ($driver, $warehouseId, $items, $creatorId) {
            $loaded = 0;
            $short = [];

            foreach ($items as $item) {
                $productId = (int) $item['product_id'];
                $requested = (float) $item['quantity'];

                if ($requested <= 0) {
                    continue;
                }

                $stock = WarehouseStock::where('product_id', $productId)
                    ->where('warehouse_id', $warehouseId)
                    ->lockForUpdate()
                    ->first();

                $available = (float) ($stock->quantity ?? 0);

                // Load what the warehouse actually has rather than failing the
                // whole run; the caller is told what fell short.
                $quantity = min($requested, $available);

                if ($quantity <= 0) {
                    $short[] = ['product_id' => $productId, 'requested' => $requested, 'available' => $available];
                    continue;
                }

                if ($quantity < $requested) {
                    $short[] = ['product_id' => $productId, 'requested' => $requested, 'available' => $available];
                }

                $stock->quantity = $available - $quantity;
                $stock->save();

                $this->adjustVan($driver, $productId, $quantity, $warehouseId, DriverStockMovement::TYPE_LOAD, $creatorId);
                $loaded++;
            }

            return ['loaded' => $loaded, 'short' => $short];
        });
    }

    /**
     * Return stock from the vehicle to a warehouse.
     *
     * @param array<int, array{product_id: int, quantity: float}> $items
     */
    public function unload(Driver $driver, int $warehouseId, array $items, int $creatorId): int
    {
        return DB::transaction(function () use ($driver, $warehouseId, $items, $creatorId) {
            $unloaded = 0;

            foreach ($items as $item) {
                $productId = (int) $item['product_id'];
                $requested = (float) $item['quantity'];

                if ($requested <= 0) {
                    continue;
                }

                $van = DriverStock::where('driver_id', $driver->id)
                    ->where('product_id', $productId)
                    ->lockForUpdate()
                    ->first();

                // A driver cannot hand back more than they are carrying.
                $quantity = min($requested, (float) ($van->quantity ?? 0));

                if ($quantity <= 0) {
                    continue;
                }

                $warehouse = WarehouseStock::firstOrCreate(
                    ['product_id' => $productId, 'warehouse_id' => $warehouseId],
                    ['quantity' => 0]
                );
                $warehouse->quantity = (float) $warehouse->quantity + $quantity;
                $warehouse->save();

                $this->adjustVan($driver, $productId, -$quantity, $warehouseId, DriverStockMovement::TYPE_UNLOAD, $creatorId);
                $unloaded++;
            }

            return $unloaded;
        });
    }

    /** Movement history for one driver, newest first. */
    public function history(Driver $driver, int $limit = 50): Collection
    {
        return DriverStockMovement::where('driver_id', $driver->id)
            ->leftJoin('product_service_items', 'product_service_items.id', '=', 'driver_stock_movements.product_id')
            ->orderByDesc('driver_stock_movements.id')
            ->limit($limit)
            ->get([
                'driver_stock_movements.id',
                'driver_stock_movements.type',
                'driver_stock_movements.quantity',
                'driver_stock_movements.quantity_after',
                'driver_stock_movements.created_at',
                'product_service_items.name as product_name',
            ])
            ->map(fn ($row) => [
                'id' => $row->id,
                'type' => $row->type,
                'quantity' => (float) $row->quantity,
                'quantity_after' => (float) $row->quantity_after,
                'product_name' => $row->product_name ?? '-',
                'created_at' => $row->created_at,
            ])
            ->values();
    }

    /**
     * Apply a signed change to the van and record it.
     *
     * @param float $delta Positive loads onto the van, negative takes off it.
     */
    private function adjustVan(
        Driver $driver,
        int $productId,
        float $delta,
        ?int $warehouseId,
        string $type,
        int $creatorId
    ): void {
        $van = DriverStock::firstOrCreate(
            ['driver_id' => $driver->id, 'product_id' => $productId],
            ['quantity' => 0, 'created_by' => $driver->created_by]
        );

        $quantity = max(0, (float) $van->quantity + $delta);
        $van->update(['quantity' => $quantity]);

        DriverStockMovement::create([
            'driver_id' => $driver->id,
            'warehouse_id' => $warehouseId,
            'product_id' => $productId,
            'type' => $type,
            'quantity' => $delta,
            'quantity_after' => $quantity,
            'creator_id' => $creatorId,
            'created_by' => $driver->created_by,
        ]);
    }
}
