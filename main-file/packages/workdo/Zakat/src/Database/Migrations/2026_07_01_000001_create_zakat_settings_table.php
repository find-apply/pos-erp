<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('zakat_settings')) {
            Schema::create('zakat_settings', function (Blueprint $table) {
                $table->id();
                $table->decimal('nisab_amount', 15, 2)->default(0);
                $table->decimal('rate_percent', 5, 2)->default(2.50);
                $table->date('haul_start_date')->nullable();
                $table->string('inventory_valuation_method')->default('sale_price');
                $table->unsignedSmallInteger('liability_due_within_days')->default(354);
                $table->string('receivable_policy')->default('collectible');
                $table->boolean('show_guidance')->default(true);
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->unique();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('zakat_settings');
    }
};
