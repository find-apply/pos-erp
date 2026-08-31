<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('production_order_items')) {
            Schema::create('production_order_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('order_id')->constrained('production_orders')->cascadeOnDelete();
                $table->foreignId('product_id')->constrained('product_service_items')->restrictOnDelete();
                // Snapshot of what the recipe asked for versus what was actually
                // consumed, so a completed order stays auditable.
                $table->decimal('planned_quantity', 15, 4)->default(0);
                $table->decimal('consumed_quantity', 15, 4)->default(0);
                $table->decimal('unit_cost', 15, 2)->default(0);
                $table->decimal('line_cost', 15, 2)->default(0);
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['order_id', 'product_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('production_order_items');
    }
};
