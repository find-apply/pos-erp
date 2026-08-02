<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('zakat_calculation_lines')) {
            Schema::create('zakat_calculation_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('zakat_calculation_id')->constrained('zakat_calculations')->onDelete('cascade');
                $table->string('line_type');
                $table->string('source_table')->nullable();
                $table->unsignedBigInteger('source_id')->nullable();
                $table->string('title');
                $table->text('description')->nullable();
                $table->text('explanation')->nullable();
                $table->decimal('quantity', 15, 2)->nullable();
                $table->decimal('unit_value', 15, 2)->nullable();
                $table->decimal('amount', 15, 2)->default(0);
                $table->string('direction')->default('asset');
                $table->boolean('is_included')->default(true);
                $table->json('metadata')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['line_type', 'direction']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('zakat_calculation_lines');
    }
};
