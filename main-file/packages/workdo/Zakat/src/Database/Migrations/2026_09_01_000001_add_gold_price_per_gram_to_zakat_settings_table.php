<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('zakat_settings') && !Schema::hasColumn('zakat_settings', 'gold_price_per_gram')) {
            Schema::table('zakat_settings', function (Blueprint $table) {
                // Defaulted rather than nullable so companies that never opened
                // the settings still get a working nisab: the service derives it
                // as 85 grams of gold whenever no nisab has been set by hand.
                // Keep in step with ZakatCalculationService::DEFAULT_GOLD_PRICE_PER_GRAM.
                $table->decimal('gold_price_per_gram', 15, 2)->default(12000)->after('nisab_amount');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('zakat_settings') && Schema::hasColumn('zakat_settings', 'gold_price_per_gram')) {
            Schema::table('zakat_settings', function (Blueprint $table) {
                $table->dropColumn('gold_price_per_gram');
            });
        }
    }
};
