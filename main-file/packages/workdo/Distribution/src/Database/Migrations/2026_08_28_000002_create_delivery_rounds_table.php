<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A round ("tournée") is one driver's run for one day: a vehicle, a departure
 * warehouse, and an ordered list of delivery notes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_rounds')) {
            return;
        }

        Schema::create('delivery_rounds', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->nullable();
            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable();
            $table->foreignId('warehouse_id')->nullable();
            $table->date('round_date');
            $table->string('status')->default('planned');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('creator_id')->nullable()->index();
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->index(['created_by', 'round_date']);
            $table->index(['created_by', 'status']);
            $table->index(['driver_id', 'round_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_rounds');
    }
};
