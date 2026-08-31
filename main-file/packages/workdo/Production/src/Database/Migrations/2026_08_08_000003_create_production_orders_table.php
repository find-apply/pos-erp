<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('production_orders')) {
            Schema::create('production_orders', function (Blueprint $table) {
                $table->id();
                $table->string('order_number');
                $table->foreignId('recipe_id')->constrained('production_recipes')->restrictOnDelete();
                $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
                $table->decimal('planned_quantity', 15, 4)->default(1);
                $table->decimal('produced_quantity', 15, 4)->default(0);
                // draft -> in_progress -> completed (or cancelled)
                $table->string('status')->default('draft');
                $table->date('planned_date')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                // Costs are frozen at completion so later price changes cannot
                // rewrite what a finished run actually cost.
                $table->decimal('material_cost', 15, 2)->default(0);
                $table->decimal('loss_cost', 15, 2)->default(0);
                $table->decimal('unit_cost', 15, 2)->default(0);
                $table->text('notes')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->unique(['created_by', 'order_number']);
                $table->index(['created_by', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('production_orders');
    }
};
