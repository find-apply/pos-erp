<?php

namespace Workdo\Zakat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ZakatAdjustment extends Model
{
    protected $fillable = [
        'zakat_calculation_id',
        'adjustment_type',
        'title',
        'amount',
        'reason',
        'source_type',
        'source_id',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function calculation(): BelongsTo
    {
        return $this->belongsTo(ZakatCalculation::class, 'zakat_calculation_id');
    }
}
