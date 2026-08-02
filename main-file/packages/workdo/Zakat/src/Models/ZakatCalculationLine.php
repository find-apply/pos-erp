<?php

namespace Workdo\Zakat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ZakatCalculationLine extends Model
{
    protected $fillable = [
        'zakat_calculation_id',
        'line_type',
        'source_table',
        'source_id',
        'title',
        'description',
        'explanation',
        'quantity',
        'unit_value',
        'amount',
        'direction',
        'is_included',
        'metadata',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_value' => 'decimal:2',
            'amount' => 'decimal:2',
            'is_included' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function calculation(): BelongsTo
    {
        return $this->belongsTo(ZakatCalculation::class, 'zakat_calculation_id');
    }
}
