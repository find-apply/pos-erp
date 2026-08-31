<?php

namespace Workdo\Distribution\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeliveryNote extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ASSIGNED = 'assigned';
    public const STATUS_IN_TRANSIT = 'in_transit';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_FAILED = 'failed';
    public const STATUS_RETURNED = 'returned';

    /** Statuses that still need a driver to do something. */
    public const OPEN_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_ASSIGNED,
        self::STATUS_IN_TRANSIT,
    ];

    protected $fillable = [
        'reference',
        'customer_id',
        'warehouse_id',
        'sales_invoice_id',
        'pos_id',
        'round_id',
        'sequence',
        'driver_id',
        'vehicle_id',
        'status',
        'scheduled_date',
        'delivered_at',
        'total_amount',
        'collected_amount',
        'latitude',
        'longitude',
        'recipient_name',
        'signature_path',
        'failure_reason',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'delivered_at' => 'datetime',
            'total_amount' => 'decimal:2',
            'collected_amount' => 'decimal:2',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function round(): BelongsTo
    {
        return $this->belongsTo(DeliveryRound::class, 'round_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(DeliveryNoteItem::class);
    }
}
