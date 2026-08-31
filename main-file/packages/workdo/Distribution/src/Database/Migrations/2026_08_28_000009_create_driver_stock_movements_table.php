<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit trail for stock moving between a warehouse and a driver's vehicle.
 *
 * `driver_stocks` holds the running quantity; this records how it got there,
 * for the same reason the cash box has a ledger - goods that changed hands
 * with no record cannot be reconciled or disputed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('driver_stock_movements')) {
            return;
        }

        Schema::create('driver_stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('distribution_drivers')->cascadeOnDelete();
            $table->foreignId('warehouse_id')->nullable();
            $table->foreignId('product_id')->nullable();
            $table->string('type');
            // Signed: positive is loaded onto the van, negative is returned.
            $table->decimal('quantity', 15, 2);
            $table->decimal('quantity_after', 15, 2);
            $table->text('notes')->nullable();
            $table->foreignId('creator_id')->nullable()->index();
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->index(['driver_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_stock_movements');
    }
};
