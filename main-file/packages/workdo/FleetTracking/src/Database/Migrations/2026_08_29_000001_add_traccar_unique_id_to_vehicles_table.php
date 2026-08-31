<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Traccar identifies a device by its own `uniqueId` - usually the tracker's
 * IMEI, which is fixed in hardware and so cannot be set to our device token.
 * This column is the join between the two systems.
 *
 * Kept separate from `gps_device_token` because that token is a shared secret
 * used to authenticate direct device posts, whereas a Traccar uniqueId is
 * public and only identifies which vehicle a forwarded position belongs to.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('traccar_unique_id')->nullable()->after('gps_device_name');
            $table->unique('traccar_unique_id');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropUnique(['traccar_unique_id']);
            $table->dropColumn('traccar_unique_id');
        });
    }
};
