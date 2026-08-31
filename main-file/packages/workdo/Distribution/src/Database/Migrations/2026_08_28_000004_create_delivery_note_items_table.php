<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lines on a delivery note. `delivered_quantity` trails `quantity` so a
 * partial delivery records what actually landed without losing what was loaded.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_note_items')) {
            return;
        }

        Schema::create('delivery_note_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_note_id')->constrained('delivery_notes')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable();
            $table->string('description')->nullable();
            $table->decimal('quantity', 15, 2)->default(0);
            $table->decimal('delivered_quantity', 15, 2)->default(0);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->foreignId('creator_id')->nullable()->index();
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->index('delivery_note_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_note_items');
    }
};
