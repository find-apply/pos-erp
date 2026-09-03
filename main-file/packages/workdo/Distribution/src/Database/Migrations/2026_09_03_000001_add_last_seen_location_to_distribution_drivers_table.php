<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distribution_drivers', function (Blueprint $table) {
            if (!Schema::hasColumn('distribution_drivers', 'last_latitude')) {
                $table->decimal('last_latitude', 10, 7)->nullable();
            }

            if (!Schema::hasColumn('distribution_drivers', 'last_longitude')) {
                $table->decimal('last_longitude', 10, 7)->nullable();
            }

            if (!Schema::hasColumn('distribution_drivers', 'last_position_at')) {
                $table->timestamp('last_position_at')->nullable();
            }

            if (!Schema::hasColumn('distribution_drivers', 'last_app_opened_at')) {
                $table->timestamp('last_app_opened_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('distribution_drivers', function (Blueprint $table) {
            if (Schema::hasColumn('distribution_drivers', 'last_app_opened_at')) {
                $table->dropColumn('last_app_opened_at');
            }

            if (Schema::hasColumn('distribution_drivers', 'last_position_at')) {
                $table->dropColumn('last_position_at');
            }

            if (Schema::hasColumn('distribution_drivers', 'last_longitude')) {
                $table->dropColumn('last_longitude');
            }

            if (Schema::hasColumn('distribution_drivers', 'last_latitude')) {
                $table->dropColumn('last_latitude');
            }
        });
    }
};
