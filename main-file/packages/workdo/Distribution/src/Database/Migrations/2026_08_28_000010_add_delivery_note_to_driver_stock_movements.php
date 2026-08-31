<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ties a van stock movement to the delivery that caused it.
 *
 * A delivery may draw partly from the van and partly from the warehouse, so
 * reversing it has to put each part back where it came from. Without this link
 * the reversal can only guess.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_stock_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('driver_stock_movements', 'delivery_note_id')) {
                $table->foreignId('delivery_note_id')->nullable()->after('warehouse_id');
                $table->index(['delivery_note_id', 'product_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('driver_stock_movements', function (Blueprint $table) {
            $table->dropColumn('delivery_note_id');
        });
    }
};
