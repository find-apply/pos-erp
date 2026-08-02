<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('vehicle_assignments')) {
            Schema::create('vehicle_assignments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
                $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('starts_at')->nullable();
                $table->timestamp('ends_at')->nullable();
                $table->string('status')->default('active');
                $table->text('notes')->nullable();
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->index(['created_by', 'status']);
                $table->index(['driver_id', 'status']);
                $table->index(['vehicle_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_assignments');
    }
};
