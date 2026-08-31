<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stock a driver is carrying in their vehicle.
 *
 * Van sales means the driver leaves the warehouse holding inventory and sells
 * from it, so their van is a stock location in its own right - the warehouse
 * total alone can no longer say where the goods are.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('driver_stocks')) {
            return;
        }

        Schema::create('driver_stocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('distribution_drivers')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable();
            $table->decimal('quantity', 15, 2)->default(0);
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->unique(['driver_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_stocks');
    }
};
