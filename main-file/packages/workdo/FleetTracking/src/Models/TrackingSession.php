<?php

namespace Workdo\FleetTracking\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrackingSession extends Model
{
    protected $fillable = [
        'vehicle_id',
        'driver_id',
        'status',
        'source',
        'started_at',
        'ended_at',
        'consent_accepted_at',
        'last_ping_at',
        'notes',
        'creator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'consent_accepted_at' => 'datetime',
            'last_ping_at' => 'datetime',
        ];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function pings(): HasMany
    {
        return $this->hasMany(LocationPing::class);
    }
}
