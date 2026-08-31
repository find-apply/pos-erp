<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The delivery note ("bon de livraison") is the unit of distribution work.
 *
 * It stands on its own rather than hanging off a sale: goods often leave on a
 * BL before any invoice exists, so `sales_invoice_id` and `pos_id` are both
 * optional back-references rather than the parent.
 *
 * `collected_amount` carries the cash-on-delivery model - the driver collects
 * on the doorstep and settles later, so what was billed and what came back are
 * tracked separately.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_notes')) {
            return;
        }

        Schema::create('delivery_notes', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->nullable();
            $table->foreignId('customer_id')->nullable();
            $table->foreignId('warehouse_id')->nullable();
            $table->foreignId('sales_invoice_id')->nullable();
            $table->foreignId('pos_id')->nullable();

            $table->foreignId('round_id')->nullable()->constrained('delivery_rounds')->nullOnDelete();
            $table->unsignedInteger('sequence')->default(0);

            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('vehicle_id')->nullable();

            $table->string('status')->default('pending');
            $table->date('scheduled_date')->nullable();
            $table->timestamp('delivered_at')->nullable();

            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('collected_amount', 15, 2)->default(0);

            // Destination is snapshotted so a later customer edit cannot rewrite
            // where a past delivery actually went.
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->string('recipient_name')->nullable();
            $table->string('signature_path')->nullable();
            $table->text('failure_reason')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('creator_id')->nullable()->index();
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->index(['created_by', 'status']);
            $table->index(['created_by', 'scheduled_date']);
            $table->index(['round_id', 'sequence']);
            $table->index(['driver_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_notes');
    }
};
