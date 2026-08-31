<?php

namespace Workdo\Distribution\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\DeliveryNoteItem;
use Workdo\Distribution\Models\Driver;
use Workdo\Distribution\Models\DriverStock;
use Workdo\Distribution\Models\DriverStockMovement;
use Workdo\ProductService\Models\WarehouseStock;

/**
 * Issuing and amending delivery notes, and the stock that moves with them.
 *
 * Stock leaves the warehouse when the note is delivered, not when it is
 * written - goods sitting on a pending note have not left the building yet.
 */
class DeliveryNoteService
{
    /** Statuses at which the goods are considered to have left the warehouse. */
    private const CONSUMES_STOCK = [
        DeliveryNote::STATUS_DELIVERED,
        DeliveryNote::STATUS_PARTIAL,
    ];

    public function create(array $data, int $companyId, int $creatorId): DeliveryNote
    {
        return DB::transaction(function () use ($data, $companyId, $creatorId) {
            $note = DeliveryNote::create([
                'reference' => ($data['reference'] ?? null) ?: $this->nextReference($companyId),
                'customer_id' => $data['customer_id'],
                'warehouse_id' => $data['warehouse_id'] ?? null,
                'sales_invoice_id' => $data['sales_invoice_id'] ?? null,
                'pos_id' => $data['pos_id'] ?? null,
                'driver_id' => $data['driver_id'] ?? null,
                'round_id' => $data['round_id'] ?? null,
                'status' => $data['driver_id'] ?? null ? DeliveryNote::STATUS_ASSIGNED : DeliveryNote::STATUS_PENDING,
                'scheduled_date' => $data['scheduled_date'] ?? today(),
                'notes' => $data['notes'] ?? null,
                'creator_id' => $creatorId,
                'created_by' => $companyId,
            ]);

            $this->syncItems($note, $data['items'] ?? [], $companyId);
            $this->syncDestination($note);

            return $note->refresh();
        });
    }

    public function update(DeliveryNote $note, array $data): DeliveryNote
    {
        return DB::transaction(function () use ($note, $data) {
            $note->update([
                'customer_id' => $data['customer_id'],
                'warehouse_id' => $data['warehouse_id'] ?? null,
                'driver_id' => $data['driver_id'] ?? null,
                'round_id' => $data['round_id'] ?? null,
                'scheduled_date' => $data['scheduled_date'] ?? $note->scheduled_date,
                'notes' => $data['notes'] ?? null,
            ]);

            // An unassigned note drops back to pending so the board stays honest.
            if (in_array($note->status, DeliveryNote::OPEN_STATUSES, true)) {
                $note->update([
                    'status' => $note->driver_id
                        ? DeliveryNote::STATUS_ASSIGNED
                        : DeliveryNote::STATUS_PENDING,
                ]);
            }

            $this->syncItems($note, $data['items'] ?? [], (int) $note->created_by);
            $this->syncDestination($note);

            return $note->refresh();
        });
    }

    public function delete(DeliveryNote $note): void
    {
        DB::transaction(function () use ($note) {
            // Goods already gone are returned to the warehouse, otherwise
            // deleting a delivered note would quietly lose the stock.
            if (in_array($note->status, self::CONSUMES_STOCK, true)) {
                $this->returnStock($note);
            }

            $note->delete();
        });
    }

    /**
     * Move stock for a note whose status is changing.
     *
     * Called when a driver completes a delivery: the delivered quantities
     * leave the note's warehouse exactly once, and come back if the note is
     * later reopened.
     */
    public function applyStockForStatus(DeliveryNote $note, string $from, string $to): void
    {
        $wasOut = in_array($from, self::CONSUMES_STOCK, true);
        $isOut = in_array($to, self::CONSUMES_STOCK, true);

        if ($wasOut === $isOut) {
            return;
        }

        $isOut ? $this->issueStock($note) : $this->returnStock($note);
    }

    /**
     * Replace the note's lines and recompute its total.
     *
     * @param array<int, array{product_id: int|null, description: string|null, quantity: float, unit_price: float}> $items
     */
    private function syncItems(DeliveryNote $note, array $items, int $companyId): void
    {
        $note->items()->delete();

        $total = 0.0;

        foreach ($items as $item) {
            $quantity = (float) ($item['quantity'] ?? 0);
            $price = (float) ($item['unit_price'] ?? 0);
            $total += $quantity * $price;

            DeliveryNoteItem::create([
                'delivery_note_id' => $note->id,
                'product_id' => $item['product_id'] ?? null,
                'description' => $item['description'] ?? null,
                'quantity' => $quantity,
                // What was loaded is what is expected to arrive; the driver
                // reduces this only when a delivery comes back partial.
                'delivered_quantity' => $quantity,
                'unit_price' => $price,
                'creator_id' => $note->creator_id,
                'created_by' => $companyId,
            ]);
        }

        $note->update(['total_amount' => round($total, 2)]);
    }

    /** Snapshot the customer's pin so a later edit cannot rewrite history. */
    private function syncDestination(DeliveryNote $note): void
    {
        if ($note->latitude !== null && $note->longitude !== null) {
            return;
        }

        $customer = DB::table('customers')->where('id', $note->customer_id)->first(['latitude', 'longitude']);

        if ($customer && $customer->latitude !== null && $customer->longitude !== null) {
            $note->update([
                'latitude' => $customer->latitude,
                'longitude' => $customer->longitude,
            ]);
        }
    }

    /**
     * Take the goods out of stock, from wherever they actually are.
     *
     * A driver carrying the goods delivers from their van; the warehouse
     * released them when the van was loaded, so charging it again would count
     * the same goods out twice. Anything the van is short of comes from the
     * warehouse, which covers a load-and-go delivery that never sat on a van.
     */
    private function issueStock(DeliveryNote $note): void
    {
        $driver = $note->driver_id ? Driver::where('user_id', $note->driver_id)->first() : null;

        foreach ($note->items()->get() as $item) {
            if (!$item->product_id) {
                continue;
            }

            $outstanding = (float) $item->delivered_quantity;

            if ($driver) {
                $outstanding -= $this->takeFromVan($driver, $note, (int) $item->product_id, $outstanding);
            }

            if ($outstanding > 0) {
                $this->adjustWarehouse($note, (int) $item->product_id, -$outstanding);
            }
        }
    }

    /**
     * Undo an issue, returning each part to where it came from.
     *
     * The recorded movements say how much left the van, so the rest must have
     * come from the warehouse.
     */
    private function returnStock(DeliveryNote $note): void
    {
        $driver = $note->driver_id ? Driver::where('user_id', $note->driver_id)->first() : null;

        foreach ($note->items()->get() as $item) {
            if (!$item->product_id) {
                continue;
            }

            $fromVan = 0.0;

            if ($driver) {
                $fromVan = abs((float) DriverStockMovement::where('delivery_note_id', $note->id)
                    ->where('driver_id', $driver->id)
                    ->where('product_id', $item->product_id)
                    ->where('type', DriverStockMovement::TYPE_SALE)
                    ->sum('quantity'));

                if ($fromVan > 0) {
                    $this->adjustVan($driver, $note, (int) $item->product_id, $fromVan);
                }
            }

            $fromWarehouse = (float) $item->delivered_quantity - $fromVan;

            if ($fromWarehouse > 0) {
                $this->adjustWarehouse($note, (int) $item->product_id, $fromWarehouse);
            }
        }

        // The sale rows are spent once reversed, so a second reversal cannot
        // credit the van twice.
        DriverStockMovement::where('delivery_note_id', $note->id)
            ->where('type', DriverStockMovement::TYPE_SALE)
            ->delete();
    }

    /**
     * @return float How much the van could actually cover.
     */
    private function takeFromVan(Driver $driver, DeliveryNote $note, int $productId, float $wanted): float
    {
        $van = DriverStock::where('driver_id', $driver->id)
            ->where('product_id', $productId)
            ->lockForUpdate()
            ->first();

        $available = (float) ($van->quantity ?? 0);
        $taken = min($wanted, $available);

        if ($taken > 0) {
            $this->adjustVan($driver, $note, $productId, -$taken);
        }

        return $taken;
    }

    /** @param float $delta Positive puts stock back on the van. */
    private function adjustVan(Driver $driver, DeliveryNote $note, int $productId, float $delta): void
    {
        $van = DriverStock::firstOrCreate(
            ['driver_id' => $driver->id, 'product_id' => $productId],
            ['quantity' => 0, 'created_by' => $driver->created_by]
        );

        $quantity = max(0, (float) $van->quantity + $delta);
        $van->update(['quantity' => $quantity]);

        DriverStockMovement::create([
            'driver_id' => $driver->id,
            'warehouse_id' => $note->warehouse_id,
            'delivery_note_id' => $note->id,
            'product_id' => $productId,
            'type' => DriverStockMovement::TYPE_SALE,
            'quantity' => $delta,
            'quantity_after' => $quantity,
            'created_by' => $note->created_by,
        ]);
    }

    /** @param float $delta Positive returns stock to the warehouse. */
    private function adjustWarehouse(DeliveryNote $note, int $productId, float $delta): void
    {
        if (!$note->warehouse_id) {
            return;
        }

        $stock = WarehouseStock::firstOrCreate(
            ['product_id' => $productId, 'warehouse_id' => $note->warehouse_id],
            ['quantity' => 0]
        );

        // Never let a warehouse go negative, matching how transfers behave.
        $stock->quantity = max(0, (float) $stock->quantity + $delta);
        $stock->save();
    }

    /** Sequential per-company reference, e.g. BL-2026-0001. */
    public function nextReference(int $companyId): string
    {
        $prefix = 'BL-'.now()->year.'-';

        $last = DeliveryNote::where('created_by', $companyId)
            ->where('reference', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('reference');

        $next = $last ? ((int) Str::afterLast($last, '-')) + 1 : 1;

        // 3 digits, matching the round references and the notes already in the
        // data. Padding is a minimum width, not a cap - note 1000 simply gets
        // four digits rather than colliding.
        return $prefix.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }
}
