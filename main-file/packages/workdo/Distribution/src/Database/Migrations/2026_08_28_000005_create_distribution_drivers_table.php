<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Distribution profile for a driver.
 *
 * Identity still lives on `users` - delivery notes point there and the
 * existing /livreur login depends on it - so this table carries only what
 * distribution adds: the driver's own cash box, the short code they are known
 * by, the access code they sign into the mobile app with, and their selling
 * limits.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_drivers')) {
            return;
        }

        Schema::create('distribution_drivers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('phone')->nullable();
            $table->string('vehicle_label')->nullable();
            $table->string('access_code', 6);

            $table->boolean('allow_credit')->default(true);
            $table->string('max_discount_type')->default('percent');
            $table->decimal('max_discount_value', 15, 2)->default(0);

            // Cash the driver is holding from collections, before settlement.
            $table->decimal('cash_balance', 15, 2)->default(0);
            $table->string('status')->default('active');

            $table->foreignId('creator_id')->nullable()->index();
            $table->foreignId('created_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            // Both identify a driver when they sign in, so both must be
            // unambiguous inside the company.
            $table->unique(['created_by', 'code']);
            $table->unique(['created_by', 'access_code']);
            $table->index(['created_by', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_drivers');
    }
};
