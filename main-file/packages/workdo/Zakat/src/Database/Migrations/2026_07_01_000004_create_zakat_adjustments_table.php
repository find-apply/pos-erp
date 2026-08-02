<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('zakat_adjustments')) {
            Schema::create('zakat_adjustments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('zakat_calculation_id')->nullable()->constrained('zakat_calculations')->onDelete('cascade');
                $table->string('adjustment_type');
                $table->string('title');
                $table->decimal('amount', 15, 2)->default(0);
                $table->text('reason');
                $table->string('source_type')->nullable();
                $table->unsignedBigInteger('source_id')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('zakat_adjustments');
    }
};
