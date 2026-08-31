<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit trail for a driver's cash box.
 *
 * The balance on `distribution_drivers` is a running total; this is the record
 * of how it got there. Cash-on-delivery money that cannot be traced back to a
 * delivery or a settlement is money nobody can defend in a dispute.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('driver_cash_movements')) {
            return;
        }

        Schema::create('driver_cash_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained('distribution_drivers')->cascadeOnDelete();
            $table->foreignId('delivery_note_id')->nullable()->constrained('delivery_notes')->nullOnDelete();
            $table->string('type');
            // Signed: positive is cash collected, negative is cash handed in.
            $table->decimal('amount', 15, 2);
            $table->decimal('balance_after', 15, 2);
            $table->text('notes')->nullable();
            $table->foreignId('creator_id')->nullable()->index();
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->index(['driver_id', 'created_at']);
            $table->index(['created_by', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_cash_movements');
    }
};
