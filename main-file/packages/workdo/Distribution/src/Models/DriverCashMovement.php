<?php

namespace Workdo\Distribution\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverCashMovement extends Model
{
    public const TYPE_COLLECTION = 'collection';
    public const TYPE_SETTLEMENT = 'settlement';

    protected $fillable = [
        'driver_id',
        'delivery_note_id',
        'type',
        'amount',
        'balance_after',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
        ];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function deliveryNote(): BelongsTo
    {
        return $this->belongsTo(DeliveryNote::class);
    }
}
