<?php

namespace Workdo\Distribution\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\DeliveryNoteItem;
use Workdo\Distribution\Models\DeliveryRound;

/**
 * A day of distribution for the demo company: one round in progress, one
 * delivery collected in full, one still pending, and one partially collected
 * so the receivables tile has something to show.
 */
class DistributionDemoSeeder extends Seeder
{
    public function run(?int $companyId = null): void
    {
        $companyId = $companyId ?? User::where('type', 'company')->value('id');

        if (!$companyId || DeliveryNote::where('created_by', $companyId)->exists()) {
            return;
        }

        $driver = User::where('created_by', $companyId)
            ->whereNotIn('type', ['client', 'vendor', 'company'])
            ->orderBy('id')
            ->first();

        if (!$driver) {
            return;
        }

        $customers = DB::table('customers')->where('created_by', $companyId)->orderBy('id')->pluck('id');

        $round = DeliveryRound::create([
            'reference' => 'TRN-2026-001',
            'driver_id' => $driver->id,
            'round_date' => today(),
            'status' => DeliveryRound::STATUS_IN_PROGRESS,
            'started_at' => now()->subHours(3),
            'creator_id' => $companyId,
            'created_by' => $companyId,
        ]);

        $notes = [
            [
                'reference' => 'BL-2026-001',
                'customer_id' => $customers->get(0),
                'round_id' => $round->id,
                'sequence' => 1,
                'status' => DeliveryNote::STATUS_DELIVERED,
                'delivered_at' => now()->subHour(),
                'total_amount' => 15000,
                'collected_amount' => 15000,
                'latitude' => 36.7486698,
                'longitude' => 3.0544100,
                'recipient_name' => 'Dr. Samira Khelifi',
            ],
            [
                'reference' => 'BL-2026-002',
                'customer_id' => $customers->get(1),
                'round_id' => $round->id,
                'sequence' => 2,
                'status' => DeliveryNote::STATUS_PENDING,
                'total_amount' => 8500,
                'latitude' => 36.4700000,
                'longitude' => 2.8300000,
            ],
            [
                'reference' => 'BL-2026-003',
                'customer_id' => $customers->get(2),
                'status' => DeliveryNote::STATUS_PARTIAL,
                'delivered_at' => now(),
                'total_amount' => 12000,
                'collected_amount' => 5000,
                'latitude' => 36.2675000,
                'longitude' => 2.7539000,
            ],
        ];

        $products = DB::table('product_service_items')
            ->where('created_by', $companyId)
            ->orderBy('id')
            ->get(['id', 'name', 'sale_price']);

        foreach ($notes as $index => $note) {
            $created = DeliveryNote::create(array_merge([
                'driver_id' => $driver->id,
                'scheduled_date' => today(),
                'creator_id' => $companyId,
                'created_by' => $companyId,
            ], $note));

            // A note with no lines prints an empty receipt, so the demo data
            // carries the same shape a real one would.
            $product = $products->get($index);

            if (!$product) {
                continue;
            }

            $price = (float) ($product->sale_price ?: 1000);
            $quantity = max(1, (int) round((float) $created->total_amount / max($price, 1)));

            DeliveryNoteItem::create([
                'delivery_note_id' => $created->id,
                'product_id' => $product->id,
                'description' => $product->name,
                'quantity' => $quantity,
                'delivered_quantity' => $quantity,
                'unit_price' => $price,
                'creator_id' => $companyId,
                'created_by' => $companyId,
            ]);

            // Keep the stated total, which the seeder set deliberately.
            $created->update(['total_amount' => $note['total_amount']]);
        }
    }
}
