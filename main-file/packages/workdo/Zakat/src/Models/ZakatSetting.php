<?php

namespace Workdo\Zakat\Models;

use Illuminate\Database\Eloquent\Model;

class ZakatSetting extends Model
{
    protected $fillable = [
        'nisab_amount',
        'gold_price_per_gram',
        'rate_percent',
        'haul_start_date',
        'inventory_valuation_method',
        'liability_due_within_days',
        'receivable_policy',
        'show_guidance',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'nisab_amount' => 'decimal:2',
            'gold_price_per_gram' => 'decimal:2',
            'rate_percent' => 'decimal:2',
            'haul_start_date' => 'date',
            'liability_due_within_days' => 'integer',
            'show_guidance' => 'boolean',
        ];
    }
}
