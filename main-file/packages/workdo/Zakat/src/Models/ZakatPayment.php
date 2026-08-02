<?php

namespace Workdo\Zakat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Workdo\Account\Models\BankAccount;
use Workdo\Account\Models\Expense;

class ZakatPayment extends Model
{
    protected $fillable = [
        'zakat_calculation_id',
        'expense_id',
        'journal_entry_id',
        'bank_transaction_id',
        'bank_account_id',
        'payment_date',
        'amount',
        'reference_number',
        'notes',
        'status',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function calculation(): BelongsTo
    {
        return $this->belongsTo(ZakatCalculation::class, 'zakat_calculation_id');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }
}
