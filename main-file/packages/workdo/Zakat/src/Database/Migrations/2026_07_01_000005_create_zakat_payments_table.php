<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('zakat_payments')) {
            Schema::create('zakat_payments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('zakat_calculation_id')->constrained('zakat_calculations')->onDelete('cascade');
                $table->foreignId('expense_id')->nullable()->constrained('expenses')->onDelete('set null');
                $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->onDelete('set null');
                $table->foreignId('bank_transaction_id')->nullable()->constrained('bank_transactions')->onDelete('set null');
                $table->foreignId('bank_account_id')->constrained('bank_accounts')->onDelete('cascade');
                $table->date('payment_date');
                $table->decimal('amount', 15, 2);
                $table->string('reference_number')->nullable();
                $table->text('notes')->nullable();
                $table->string('status')->default('posted');
                $table->foreignId('creator_id')->nullable()->index();
                $table->foreignId('created_by')->nullable()->index();
                $table->timestamps();

                $table->foreign('creator_id')->references('id')->on('users')->onDelete('set null');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('zakat_payments');
    }
};
