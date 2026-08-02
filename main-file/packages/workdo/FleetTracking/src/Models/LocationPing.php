<?php

namespace Workdo\FleetTracking\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationPing extends Model
{
    protected $fillable = [
        'tracking_session_id',
        'vehicle_id',
        'driver_id',
        'latitude',
        'longitude',
        'accuracy',
        'speed',
        'heading',
        'battery',
        'source',
        'recorded_at',
        'meta',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'accuracy' => 'decimal:2',
            'speed' => 'decimal:2',
            'heading' => 'decimal:2',
            'battery' => 'integer',
            'recorded_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TrackingSession::class, 'tracking_session_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }
}
