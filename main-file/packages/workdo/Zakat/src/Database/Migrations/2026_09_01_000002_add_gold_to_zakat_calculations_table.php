<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('zakat_calculations')) {
            return;
        }

        Schema::table('zakat_calculations', function (Blueprint $table) {
            // Gold held as wealth is entered by weight, not value: the weight is
            // what the owner knows, and the price moves between calculations.
            // Both are snapshotted so an old calculation stays reproducible.
            if (!Schema::hasColumn('zakat_calculations', 'gold_grams')) {
                $table->decimal('gold_grams', 15, 3)->default(0)->after('nisab_amount');
            }
            if (!Schema::hasColumn('zakat_calculations', 'gold_price_per_gram')) {
                $table->decimal('gold_price_per_gram', 15, 2)->default(0)->after('gold_grams');
            }
            if (!Schema::hasColumn('zakat_calculations', 'gold_amount')) {
                $table->decimal('gold_amount', 15, 2)->default(0)->after('cash_amount');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('zakat_calculations')) {
            return;
        }

        Schema::table('zakat_calculations', function (Blueprint $table) {
            foreach (['gold_grams', 'gold_price_per_gram', 'gold_amount'] as $column) {
                if (Schema::hasColumn('zakat_calculations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
