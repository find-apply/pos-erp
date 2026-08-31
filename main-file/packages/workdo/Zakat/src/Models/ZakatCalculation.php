<?php

namespace Workdo\Zakat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ZakatCalculation extends Model
{
    protected $fillable = [
        'calculation_number',
        'calculation_date',
        'haul_start_date',
        'nisab_amount',
        'rate_percent',
        'inventory_valuation_method',
        'liability_due_within_days',
        'receivable_policy',
        'gold_grams',
        'gold_price_per_gram',
        'cash_amount',
        'gold_amount',
        'inventory_amount',
        'receivable_amount',
        'deductible_liabilities_amount',
        'manual_additions_amount',
        'manual_deductions_amount',
        'zakatable_amount',
        'zakat_due',
        'paid_amount',
        'remaining_amount',
        'is_nisab_met',
        'is_haul_met',
        'status',
        'notes',
        'finalized_at',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'calculation_date' => 'date',
            'haul_start_date' => 'date',
            'finalized_at' => 'datetime',
            'nisab_amount' => 'decimal:2',
            'rate_percent' => 'decimal:2',
            'gold_grams' => 'decimal:3',
            'gold_price_per_gram' => 'decimal:2',
            'cash_amount' => 'decimal:2',
            'gold_amount' => 'decimal:2',
            'inventory_amount' => 'decimal:2',
            'receivable_amount' => 'decimal:2',
            'deductible_liabilities_amount' => 'decimal:2',
            'manual_additions_amount' => 'decimal:2',
            'manual_deductions_amount' => 'decimal:2',
            'zakatable_amount' => 'decimal:2',
            'zakat_due' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
            'is_nisab_met' => 'boolean',
            'is_haul_met' => 'boolean',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ZakatCalculationLine::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(ZakatAdjustment::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ZakatPayment::class);
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($calculation) {
            if (empty($calculation->calculation_number)) {
                $calculation->calculation_number = static::generateCalculationNumber($calculation->created_by);
            }
        });
    }

    public static function generateCalculationNumber($createdBy = null): string
    {
        $year = date('Y');
        $month = date('m');
        $companyId = $createdBy ?: (auth()->check() ? creatorId() : 1);

        $last = static::where('calculation_number', 'like', "ZAK-{$year}-{$month}-%")
            ->where('created_by', $companyId)
            ->orderBy('calculation_number', 'desc')
            ->first();

        $nextNumber = $last ? ((int) substr($last->calculation_number, -3)) + 1 : 1;

        return "ZAK-{$year}-{$month}-".str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
    }
}
