<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('zakat_calculations')) {
            Schema::create('zakat_calculations', function (Blueprint $table) {
                $table->id();
                $table->string('calculation_number')->index();
                $table->date('calculation_date');
                $table->date('haul_start_date')->nullable();
                $table->decimal('nisab_amount', 15, 2)->default(0);
                $table->decimal('rate_percent', 5, 2)->default(2.50);
                $table->string('inventory_valuation_method')->default('sale_price');
                $table->unsignedSmallInteger('liability_due_within_days')->default(354);
                $table->string('receivable_policy')->default('collectible');
                $table->decimal('cash_amount', 15, 2)->default(0);
                $table->decimal('inventory_amount', 15, 2)->default(0);
                $table->decimal('receivable_amount', 15, 2)->default(0);
                $table->decimal('deductible_liabilities_amount', 15, 2)->default(0);
                $table->decimal('manual_additions_amount', 15, 2)->default(0);
                $table->decimal('manual_deductions_amount', 15, 2)->default(0);
                $table->decimal('zakatable_amount', 15, 2)->default(0);
                $table->decimal('zakat_due', 15, 2)->default(0);
                $table->decimal('paid_amount', 15, 2)->default(0);
                $table->decimal('remaining_amount', 15, 2)->default(0);
                $table->boolean('is_nisab_met')->default(false);
                $table->boolean('is_haul_met')->default(false);
                $table->string('status')->default('draft');
                $table->text('notes')->nullable();
                $table->timestamp('finalized_at')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['created_by', 'status']);
                $table->index(['created_by', 'calculation_date']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('zakat_calculations');
    }
};
