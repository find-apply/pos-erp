<?php

namespace Workdo\Distribution\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Driver extends Model
{
    protected $table = 'distribution_drivers';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    public const DISCOUNT_PERCENT = 'percent';
    public const DISCOUNT_AMOUNT = 'amount';

    protected $fillable = [
        'user_id',
        'name',
        'code',
        'phone',
        'vehicle_label',
        'access_code',
        'allow_credit',
        'max_discount_type',
        'max_discount_value',
        'cash_balance',
        'status',
        'last_latitude',
        'last_longitude',
        'last_position_at',
        'last_app_opened_at',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'allow_credit' => 'boolean',
            'max_discount_value' => 'decimal:2',
            'cash_balance' => 'decimal:2',
            'last_latitude' => 'decimal:7',
            'last_longitude' => 'decimal:7',
            'last_position_at' => 'datetime',
            'last_app_opened_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Delivery notes are keyed by the underlying user, not by this profile,
     * so a driver with no linked user simply has none.
     */
    public function deliveryNotes(): HasMany
    {
        return $this->hasMany(DeliveryNote::class, 'driver_id', 'user_id');
    }
}
