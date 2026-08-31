<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('production_recipes')) {
            Schema::create('production_recipes', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->nullable();
                // The finished item this recipe produces, and how much of it
                // one run yields.
                $table->foreignId('output_product_id')->constrained('product_service_items')->cascadeOnDelete();
                $table->decimal('output_quantity', 15, 4)->default(1);
                $table->string('unit')->nullable();
                $table->text('notes')->nullable();
                $table->boolean('is_active')->default(true);
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['created_by', 'is_active']);
                $table->unique(['created_by', 'code']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('production_recipes');
    }
};
