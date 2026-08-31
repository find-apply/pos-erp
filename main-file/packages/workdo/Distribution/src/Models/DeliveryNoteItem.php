<?php

namespace Workdo\Distribution\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryNoteItem extends Model
{
    protected $fillable = [
        'delivery_note_id',
        'product_id',
        'description',
        'quantity',
        'delivered_quantity',
        'unit_price',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'delivered_quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
        ];
    }

    public function deliveryNote(): BelongsTo
    {
        return $this->belongsTo(DeliveryNote::class);
    }
}
