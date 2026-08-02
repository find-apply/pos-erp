<?php

namespace Workdo\FleetTracking\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Vehicle extends Model
{
    protected $fillable = [
        'name',
        'plate_number',
        'vehicle_type',
        'status',
        'gps_device_token',
        'gps_device_name',
        'airtag_reference',
        'notes',
        'last_latitude',
        'last_longitude',
        'last_accuracy',
        'last_speed',
        'last_heading',
        'last_source',
        'last_ping_at',
        'last_location_ping_id',
        'creator_id',
        'created_by',
    ];

    protected $hidden = [
        'gps_device_token',
    ];

    protected function casts(): array
    {
        return [
            'last_latitude' => 'decimal:7',
            'last_longitude' => 'decimal:7',
            'last_accuracy' => 'decimal:2',
            'last_speed' => 'decimal:2',
            'last_heading' => 'decimal:2',
            'last_ping_at' => 'datetime',
        ];
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(VehicleAssignment::class);
    }

    public function activeAssignment(): HasOne
    {
        return $this->hasOne(VehicleAssignment::class)->where('status', 'active')->latestOfMany();
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TrackingSession::class);
    }

    public function activeSession(): HasOne
    {
        return $this->hasOne(TrackingSession::class)->where('status', 'active')->latestOfMany();
    }

    public function pings(): HasMany
    {
        return $this->hasMany(LocationPing::class);
    }
}
