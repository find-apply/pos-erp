<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('production_recipe_items')) {
            Schema::create('production_recipe_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('recipe_id')->constrained('production_recipes')->cascadeOnDelete();
                $table->foreignId('product_id')->constrained('product_service_items')->cascadeOnDelete();
                // Quantity of this material consumed per single recipe run.
                $table->decimal('quantity', 15, 4);
                // Expected process loss, applied on top of quantity when costing
                // and when consuming stock.
                $table->decimal('waste_percent', 8, 4)->default(0);
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['recipe_id', 'product_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('production_recipe_items');
    }
};
