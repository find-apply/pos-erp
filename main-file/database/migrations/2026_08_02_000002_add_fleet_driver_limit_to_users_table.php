<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'fleet_driver_limit')) {
            Schema::table('users', function (Blueprint $table) {
                // Null means unlimited - matches the "Distribution (illimité)" tier.
                $table->unsignedInteger('fleet_driver_limit')->nullable()->after('fleet_join_code');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'fleet_driver_limit')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('fleet_driver_limit');
            });
        }
    }
};
