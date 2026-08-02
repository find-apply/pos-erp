<?php

namespace Workdo\FleetTracking\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Workdo\FleetTracking\Models\LocationPing;
use Workdo\FleetTracking\Models\TrackingSession;
use Workdo\FleetTracking\Models\Vehicle;
use Workdo\FleetTracking\Models\VehicleAssignment;

class FleetTrackingService
{
    public const MOBILE_SOURCE = 'mobile_gps';
    public const DEVICE_SOURCE = 'gps_device';
    public const MANUAL_SOURCE = 'manual';
    public const AIRTAG_SOURCE = 'airtag_reference';
    public const STALE_AFTER_MINUTES = 10;

    public function dashboard(int $companyId): array
    {
        $vehicles = Vehicle::with(['activeAssignment.driver', 'activeSession.driver'])
            ->where('created_by', $companyId)
            ->orderBy('name')
            ->get();

        return [
            'vehicles' => $vehicles->map(fn (Vehicle $vehicle) => $this->vehiclePayload($vehicle))->values(),
            'summary' => $this->summary($vehicles),
        ];
    }

    public function vehicleDetail(Vehicle $vehicle): array
    {
        $vehicle->load(['activeAssignment.driver', 'activeSession.driver']);

        $pings = $vehicle->pings()
            ->with('driver:id,name,email')
            ->latest('recorded_at')
            ->take(200)
            ->get()
            ->map(fn (LocationPing $ping) => $this->pingPayload($ping))
            ->values();

        $assignments = $vehicle->assignments()
            ->with('driver:id,name,email')
            ->latest()
            ->take(30)
            ->get()
            ->map(fn (VehicleAssignment $assignment) => $this->assignmentPayload($assignment))
            ->values();

        return [
            'vehicle' => $this->vehiclePayload($vehicle),
            'pings' => $pings,
            'assignments' => $assignments,
        ];
    }

    public function driverDetail(User $driver, int $companyId): array
    {
        $assignment = VehicleAssignment::with('vehicle')
            ->where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        $session = TrackingSession::with('vehicle')
            ->where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        $pings = LocationPing::with('vehicle')
            ->where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->latest('recorded_at')
            ->take(200)
            ->get()
            ->map(fn (LocationPing $ping) => $this->pingPayload($ping))
            ->values();

        return [
            'driver' => $this->driverPayload($driver),
            'assignment' => $assignment ? $this->assignmentPayload($assignment) : null,
            'session' => $session ? $this->sessionPayload($session) : null,
            'pings' => $pings,
        ];
    }

    public function mobileState(User $driver, int $companyId): array
    {
        $assignment = VehicleAssignment::with('vehicle')
            ->where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        $session = TrackingSession::with('vehicle')
            ->where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        return [
            'driver' => $this->driverPayload($driver),
            'assignment' => $assignment ? $this->assignmentPayload($assignment) : null,
            'session' => $session ? $this->sessionPayload($session) : null,
            'tracking_policy' => [
                'interval_seconds' => 120,
                'movement_meters' => 100,
                'stationary_heartbeat_seconds' => 300,
                'stale_after_minutes' => self::STALE_AFTER_MINUTES,
                'scope' => __('Work hours only, after explicit Start tracking.'),
            ],
        ];
    }

    public function createVehicle(array $data, int $companyId, ?int $creatorId = null): Vehicle
    {
        return Vehicle::create([
            'name' => $data['name'],
            'plate_number' => $data['plate_number'],
            'vehicle_type' => $data['vehicle_type'] ?? 'van',
            'status' => $data['status'] ?? 'active',
            'gps_device_token' => $data['gps_device_token'] ?? null,
            'gps_device_name' => $data['gps_device_name'] ?? null,
            'airtag_reference' => $data['airtag_reference'] ?? null,
            'notes' => $data['notes'] ?? null,
            'creator_id' => $creatorId,
            'created_by' => $companyId,
        ]);
    }

    public function updateVehicle(Vehicle $vehicle, array $data): Vehicle
    {
        $updates = [
            'name' => $data['name'],
            'plate_number' => $data['plate_number'],
            'vehicle_type' => $data['vehicle_type'] ?? $vehicle->vehicle_type,
            'status' => $data['status'] ?? $vehicle->status,
            'gps_device_name' => $data['gps_device_name'] ?? null,
            'airtag_reference' => $data['airtag_reference'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];

        if (!empty($data['gps_device_token'])) {
            $updates['gps_device_token'] = $data['gps_device_token'];
        }

        $vehicle->update($updates);

        return $vehicle->fresh(['activeAssignment.driver', 'activeSession.driver']);
    }

    public function createAssignment(array $data, int $companyId, ?int $creatorId = null): VehicleAssignment
    {
        $vehicle = Vehicle::where('created_by', $companyId)->findOrFail($data['vehicle_id']);
        $driver = User::where('created_by', $companyId)->findOrFail($data['driver_id']);
        $startsAt = !empty($data['starts_at']) ? Carbon::parse($data['starts_at']) : now();

        return DB::transaction(function () use ($vehicle, $driver, $data, $companyId, $creatorId, $startsAt) {
            VehicleAssignment::where('created_by', $companyId)
                ->where(function ($query) use ($vehicle, $driver) {
                    $query->where('vehicle_id', $vehicle->id)
                        ->orWhere('driver_id', $driver->id);
                })
                ->where('status', 'active')
                ->update([
                    'status' => 'completed',
                    'ends_at' => now(),
                ]);

            return VehicleAssignment::create([
                'vehicle_id' => $vehicle->id,
                'driver_id' => $driver->id,
                'starts_at' => $startsAt,
                'ends_at' => !empty($data['ends_at']) ? Carbon::parse($data['ends_at']) : null,
                'status' => 'active',
                'notes' => $data['notes'] ?? null,
                'creator_id' => $creatorId,
                'created_by' => $companyId,
            ]);
        });
    }

    public function startSession(User $driver, int $companyId, ?int $vehicleId = null): TrackingSession
    {
        $assignmentQuery = VehicleAssignment::with('vehicle')
            ->where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->where('status', 'active');

        if ($vehicleId) {
            $assignmentQuery->where('vehicle_id', $vehicleId);
        }

        $assignment = $assignmentQuery->latest()->first();

        if (!$assignment) {
            throw ValidationException::withMessages([
                'vehicle_id' => __('No active vehicle assignment was found for this driver.'),
            ]);
        }

        return DB::transaction(function () use ($driver, $companyId, $assignment) {
            TrackingSession::where('created_by', $companyId)
                ->where('driver_id', $driver->id)
                ->where('status', 'active')
                ->update([
                    'status' => 'stopped',
                    'ended_at' => now(),
                ]);

            return TrackingSession::create([
                'vehicle_id' => $assignment->vehicle_id,
                'driver_id' => $driver->id,
                'status' => 'active',
                'source' => self::MOBILE_SOURCE,
                'started_at' => now(),
                'consent_accepted_at' => now(),
                'creator_id' => $driver->id,
                'created_by' => $companyId,
            ]);
        });
    }

    public function stopSession(User $driver, int $companyId): ?TrackingSession
    {
        $session = TrackingSession::where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        if (!$session) {
            return null;
        }

        $session->update([
            'status' => 'stopped',
            'ended_at' => now(),
        ]);

        return $session->fresh('vehicle');
    }

    public function recordMobilePing(User $driver, int $companyId, array $data): LocationPing
    {
        $session = TrackingSession::with('vehicle')
            ->where('created_by', $companyId)
            ->where('driver_id', $driver->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        if (!$session) {
            throw ValidationException::withMessages([
                'session' => __('Tracking must be started before sending a location.'),
            ]);
        }

        return $this->recordPing($session->vehicle, $session, $driver, $data, self::MOBILE_SOURCE, $companyId, $driver->id);
    }

    public function recordDevicePing(array $data): LocationPing
    {
        $vehicle = Vehicle::where('gps_device_token', $data['device_token'] ?? null)
            ->whereNotNull('gps_device_token')
            ->first();

        if (!$vehicle) {
            throw ValidationException::withMessages([
                'device_token' => __('Invalid GPS device token.'),
            ]);
        }

        $session = TrackingSession::where('vehicle_id', $vehicle->id)
            ->where('created_by', $vehicle->created_by)
            ->where('status', 'active')
            ->latest()
            ->first();

        if (!$session) {
            throw ValidationException::withMessages([
                'session' => __('No active work tracking session exists for this vehicle.'),
            ]);
        }

        $driver = $session->driver;

        return $this->recordPing($vehicle, $session, $driver, $data, self::DEVICE_SOURCE, (int) $vehicle->created_by, null);
    }

    public function vehicleStatus(Vehicle $vehicle): string
    {
        if ($vehicle->status !== 'active') {
            return 'offline';
        }

        if (!$vehicle->last_ping_at) {
            return 'offline';
        }

        $hasActiveSession = TrackingSession::where('vehicle_id', $vehicle->id)
            ->where('status', 'active')
            ->exists();

        if (!$hasActiveSession) {
            return 'offline';
        }

        return $vehicle->last_ping_at->greaterThanOrEqualTo(now()->subMinutes(self::STALE_AFTER_MINUTES))
            ? 'online'
            : 'stale';
    }

    public function vehiclePayload(Vehicle $vehicle): array
    {
        $assignment = $vehicle->relationLoaded('activeAssignment') ? $vehicle->activeAssignment : null;
        $session = $vehicle->relationLoaded('activeSession') ? $vehicle->activeSession : null;

        return [
            'id' => $vehicle->id,
            'name' => $vehicle->name,
            'plate_number' => $vehicle->plate_number,
            'vehicle_type' => $vehicle->vehicle_type,
            'status' => $vehicle->status,
            'tracking_status' => $this->vehicleStatus($vehicle),
            'gps_device_name' => $vehicle->gps_device_name,
            'has_device_token' => !empty($vehicle->gps_device_token),
            'airtag_reference' => $vehicle->airtag_reference,
            'notes' => $vehicle->notes,
            'last_latitude' => $vehicle->last_latitude !== null ? (float) $vehicle->last_latitude : null,
            'last_longitude' => $vehicle->last_longitude !== null ? (float) $vehicle->last_longitude : null,
            'last_accuracy' => $vehicle->last_accuracy !== null ? (float) $vehicle->last_accuracy : null,
            'last_speed' => $vehicle->last_speed !== null ? (float) $vehicle->last_speed : null,
            'last_heading' => $vehicle->last_heading !== null ? (float) $vehicle->last_heading : null,
            'last_source' => $vehicle->last_source,
            'last_ping_at' => optional($vehicle->last_ping_at)->toIso8601String(),
            'driver' => $assignment?->driver ? $this->driverPayload($assignment->driver) : ($session?->driver ? $this->driverPayload($session->driver) : null),
            'active_session' => $session ? $this->sessionPayload($session) : null,
            'created_at' => optional($vehicle->created_at)->toIso8601String(),
        ];
    }

    public function assignmentPayload(VehicleAssignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'vehicle_id' => $assignment->vehicle_id,
            'driver_id' => $assignment->driver_id,
            'status' => $assignment->status,
            'starts_at' => optional($assignment->starts_at)->toIso8601String(),
            'ends_at' => optional($assignment->ends_at)->toIso8601String(),
            'notes' => $assignment->notes,
            'vehicle' => $assignment->relationLoaded('vehicle') && $assignment->vehicle ? [
                'id' => $assignment->vehicle->id,
                'name' => $assignment->vehicle->name,
                'plate_number' => $assignment->vehicle->plate_number,
            ] : null,
            'driver' => $assignment->relationLoaded('driver') && $assignment->driver ? $this->driverPayload($assignment->driver) : null,
        ];
    }

    public function sessionPayload(TrackingSession $session): array
    {
        return [
            'id' => $session->id,
            'vehicle_id' => $session->vehicle_id,
            'driver_id' => $session->driver_id,
            'status' => $session->status,
            'source' => $session->source,
            'started_at' => optional($session->started_at)->toIso8601String(),
            'ended_at' => optional($session->ended_at)->toIso8601String(),
            'consent_accepted_at' => optional($session->consent_accepted_at)->toIso8601String(),
            'last_ping_at' => optional($session->last_ping_at)->toIso8601String(),
            'vehicle' => $session->relationLoaded('vehicle') && $session->vehicle ? [
                'id' => $session->vehicle->id,
                'name' => $session->vehicle->name,
                'plate_number' => $session->vehicle->plate_number,
            ] : null,
        ];
    }

    public function pingPayload(LocationPing $ping): array
    {
        return [
            'id' => $ping->id,
            'tracking_session_id' => $ping->tracking_session_id,
            'vehicle_id' => $ping->vehicle_id,
            'driver_id' => $ping->driver_id,
            'latitude' => (float) $ping->latitude,
            'longitude' => (float) $ping->longitude,
            'accuracy' => $ping->accuracy !== null ? (float) $ping->accuracy : null,
            'speed' => $ping->speed !== null ? (float) $ping->speed : null,
            'heading' => $ping->heading !== null ? (float) $ping->heading : null,
            'battery' => $ping->battery,
            'source' => $ping->source,
            'recorded_at' => optional($ping->recorded_at)->toIso8601String(),
            'vehicle' => $ping->relationLoaded('vehicle') && $ping->vehicle ? [
                'id' => $ping->vehicle->id,
                'name' => $ping->vehicle->name,
                'plate_number' => $ping->vehicle->plate_number,
            ] : null,
            'driver' => $ping->relationLoaded('driver') && $ping->driver ? $this->driverPayload($ping->driver) : null,
        ];
    }

    public function driverPayload(User $driver): array
    {
        return [
            'id' => $driver->id,
            'name' => $driver->name,
            'email' => $driver->email,
            'mobile_no' => $driver->mobile_no,
            'type' => $driver->type,
        ];
    }

    private function recordPing(Vehicle $vehicle, TrackingSession $session, ?User $driver, array $data, string $source, int $companyId, ?int $creatorId): LocationPing
    {
        $recordedAt = !empty($data['recorded_at']) ? Carbon::parse($data['recorded_at']) : now();

        return DB::transaction(function () use ($vehicle, $session, $driver, $data, $source, $companyId, $creatorId, $recordedAt) {
            $ping = LocationPing::create([
                'tracking_session_id' => $session->id,
                'vehicle_id' => $vehicle->id,
                'driver_id' => $driver?->id,
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'accuracy' => $data['accuracy'] ?? null,
                'speed' => $data['speed'] ?? null,
                'heading' => $data['heading'] ?? null,
                'battery' => $data['battery'] ?? null,
                'source' => $source,
                'recorded_at' => $recordedAt,
                'meta' => [
                    'user_agent' => request()?->userAgent(),
                    'ip' => request()?->ip(),
                ],
                'creator_id' => $creatorId,
                'created_by' => $companyId,
            ]);

            $session->update([
                'last_ping_at' => $recordedAt,
            ]);

            $vehicle->update([
                'last_latitude' => $ping->latitude,
                'last_longitude' => $ping->longitude,
                'last_accuracy' => $ping->accuracy,
                'last_speed' => $ping->speed,
                'last_heading' => $ping->heading,
                'last_source' => $source,
                'last_ping_at' => $recordedAt,
                'last_location_ping_id' => $ping->id,
            ]);

            return $ping;
        });
    }

    private function summary(Collection $vehicles): array
    {
        $statuses = $vehicles->map(fn (Vehicle $vehicle) => $this->vehicleStatus($vehicle))->countBy();

        return [
            'total' => $vehicles->count(),
            'online' => (int) ($statuses['online'] ?? 0),
            'stale' => (int) ($statuses['stale'] ?? 0),
            'offline' => (int) ($statuses['offline'] ?? 0),
        ];
    }
}
