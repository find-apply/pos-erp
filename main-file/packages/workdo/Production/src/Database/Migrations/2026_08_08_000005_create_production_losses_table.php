<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('production_losses')) {
            Schema::create('production_losses', function (Blueprint $table) {
                $table->id();
                // A loss may be tied to a production run, or standalone (spoilage,
                // breakage, expiry found during a stock check).
                $table->foreignId('order_id')->nullable()->constrained('production_orders')->nullOnDelete();
                $table->foreignId('product_id')->constrained('product_service_items')->restrictOnDelete();
                $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
                $table->decimal('quantity', 15, 4);
                $table->decimal('unit_cost', 15, 2)->default(0);
                $table->decimal('total_cost', 15, 2)->default(0);
                $table->string('reason')->nullable();
                $table->date('loss_date');
                $table->text('notes')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['created_by', 'loss_date']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('production_losses');
    }
};
