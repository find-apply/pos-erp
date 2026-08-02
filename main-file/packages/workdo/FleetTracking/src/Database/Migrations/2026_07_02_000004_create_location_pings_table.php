<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('location_pings')) {
            Schema::create('location_pings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tracking_session_id')->nullable()->constrained('tracking_sessions')->nullOnDelete();
                $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
                $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
                $table->decimal('latitude', 10, 7);
                $table->decimal('longitude', 10, 7);
                $table->decimal('accuracy', 8, 2)->nullable();
                $table->decimal('speed', 8, 2)->nullable();
                $table->decimal('heading', 6, 2)->nullable();
                $table->unsignedTinyInteger('battery')->nullable();
                $table->string('source')->default('mobile_gps');
                $table->timestamp('recorded_at')->index();
                $table->json('meta')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['vehicle_id', 'recorded_at']);
                $table->index(['driver_id', 'recorded_at']);
                $table->index(['created_by', 'recorded_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('location_pings');
    }
};
