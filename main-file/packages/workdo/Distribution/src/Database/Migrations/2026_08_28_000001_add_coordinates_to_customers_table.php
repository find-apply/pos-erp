<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customers carry a JSON postal address only, which is city-level at best and
 * cannot be routed to. Distribution needs a point on the map, so the delivery
 * location is pinned explicitly rather than geocoded from the address text.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (!Schema::hasColumn('customers', 'latitude')) {
                $table->decimal('latitude', 10, 7)->nullable()->after('shipping_address');
            }
            if (!Schema::hasColumn('customers', 'longitude')) {
                $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            }
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude']);
        });
    }
};
