<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('vehicles')) {
            Schema::create('vehicles', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('plate_number');
                $table->string('vehicle_type')->default('van');
                $table->string('status')->default('active');
                $table->string('gps_device_token')->nullable()->unique();
                $table->string('gps_device_name')->nullable();
                $table->string('airtag_reference')->nullable();
                $table->text('notes')->nullable();
                $table->decimal('last_latitude', 10, 7)->nullable();
                $table->decimal('last_longitude', 10, 7)->nullable();
                $table->decimal('last_accuracy', 8, 2)->nullable();
                $table->decimal('last_speed', 8, 2)->nullable();
                $table->decimal('last_heading', 6, 2)->nullable();
                $table->string('last_source')->nullable();
                $table->timestamp('last_ping_at')->nullable();
                $table->foreignId('last_location_ping_id')->nullable()->index();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->unique(['created_by', 'plate_number']);
                $table->index(['created_by', 'status']);
                $table->index(['created_by', 'last_ping_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
