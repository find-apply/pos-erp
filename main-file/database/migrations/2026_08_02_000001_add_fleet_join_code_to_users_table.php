<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'fleet_join_code')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('fleet_join_code', 12)->nullable()->unique()->after('type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'fleet_join_code')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique(['fleet_join_code']);
                $table->dropColumn('fleet_join_code');
            });
        }
    }
};
