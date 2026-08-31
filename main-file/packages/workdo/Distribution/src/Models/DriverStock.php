<?php

namespace Workdo\Distribution\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverStock extends Model
{
    protected $fillable = ['driver_id', 'product_id', 'quantity', 'created_by'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:2'];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }
}
