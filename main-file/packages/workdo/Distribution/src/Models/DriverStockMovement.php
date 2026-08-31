<?php

namespace Workdo\Distribution\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverStockMovement extends Model
{
    public const TYPE_LOAD = 'load';
    public const TYPE_UNLOAD = 'unload';
    public const TYPE_SALE = 'sale';

    protected $fillable = [
        'driver_id',
        'warehouse_id',
        'delivery_note_id',
        'product_id',
        'type',
        'quantity',
        'quantity_after',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:2', 'quantity_after' => 'decimal:2'];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}
