<?php

namespace Workdo\FleetTracking\Database\Seeders;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Workdo\FleetTracking\Models\LocationPing;
use Workdo\FleetTracking\Models\TrackingSession;
use Workdo\FleetTracking\Models\Vehicle;
use Workdo\FleetTracking\Models\VehicleAssignment;

/**
 * Demo fleet for the Algeria walkthrough: four vehicles plated by wilaya
 * (16 Alger, 31 Oran, 09 Blida, 02 Chlef) and two driver accounts.
 *
 * Timestamps are relative to now so the demo keeps showing one stale vehicle
 * and one offline vehicle whenever it is re-seeded - FleetTrackingService
 * treats a ping older than STALE_AFTER_MINUTES (10) on an active session as
 * stale, and any vehicle without an active session as offline.
 */
class FleetTrackingDemoSeeder extends Seeder
{
    public function run(): void
    {
        Model::unguard();

        $company = User::withoutGlobalScopes()->where('email', 'company@example.com')->first();

        if (!$company) {
            $this->command?->warn('FleetTrackingDemoSeeder skipped: company@example.com not found.');

            return;
        }

        $companyId = (int) $company->id;
        $staffRole = Role::where('name', 'staff')->where('created_by', $companyId)->first();

        $drivers = [];

        foreach ([
            ['name' => 'Ahmed Delivery', 'email' => 'ahmed.delivery@example.com'],
            ['name' => 'Samia Transport', 'email' => 'samia.transport@example.com'],
        ] as $driverData) {
            $driver = User::withoutGlobalScopes()->where('email', $driverData['email'])->first();

            if (!$driver) {
                $driver = User::create([
                    'name' => $driverData['name'],
                    'email' => $driverData['email'],
                    'password' => Hash::make('1234'),
                    'type' => 'staff',
                    'lang' => 'ar',
                    'email_verified_at' => now(),
                    'created_by' => $companyId,
                ]);
            }

            if ($staffRole && !$driver->hasRole($staffRole)) {
                $driver->assignRole($staffRole);
            }

            $drivers[$driverData['email']] = $driver;
        }

        // Alger city centre and the Alger -> Oran coastal corridor.
        $algerTrail = $this->trail(36.7538, 3.0588, 16, 0.004);
        $oranTrail = $this->trail(35.6971, -0.6308, 31, 0.004);

        $vehicles = [
            [
                'name' => 'Algiers Delivery Van',
                'plate_number' => '16-123-001',
                'vehicle_type' => 'van',
                'driver' => 'ahmed.delivery@example.com',
                'session_status' => 'ended',   // -> offline
                'ping_minutes_ago' => 46,
                'trail' => $algerTrail,
            ],
            [
                'name' => 'Cold Chain Truck',
                'plate_number' => '31-456-002',
                'vehicle_type' => 'truck',
                'driver' => 'samia.transport@example.com',
                'session_status' => 'active',  // -> stale, ping older than 10 min
                'ping_minutes_ago' => 18,
                'trail' => $oranTrail,
            ],
            [
                'name' => 'Maintenance Pickup',
                'plate_number' => '09-777-003',
                'vehicle_type' => 'pickup',
                'driver' => null,
                'session_status' => null,
                'ping_minutes_ago' => null,
                'trail' => [],
            ],
            [
                'name' => 'Manager Check-in Car',
                'plate_number' => '02-888-004',
                'vehicle_type' => 'car',
                'driver' => null,
                'session_status' => null,
                'ping_minutes_ago' => null,
                'trail' => [],
            ],
        ];

        foreach ($vehicles as $data) {
            $vehicle = Vehicle::updateOrCreate(
                ['created_by' => $companyId, 'plate_number' => $data['plate_number']],
                [
                    'name' => $data['name'],
                    'vehicle_type' => $data['vehicle_type'],
                    'status' => 'active',
                    'creator_id' => $companyId,
                ]
            );

            if (!$data['driver']) {
                continue;
            }

            $driver = $drivers[$data['driver']];

            VehicleAssignment::updateOrCreate(
                ['vehicle_id' => $vehicle->id, 'driver_id' => $driver->id],
                [
                    'status' => 'active',
                    'starts_at' => now()->subDays(30),
                    'creator_id' => $companyId,
                    'created_by' => $companyId,
                ]
            );

            $lastPingAt = now()->subMinutes($data['ping_minutes_ago']);

            $session = TrackingSession::updateOrCreate(
                ['vehicle_id' => $vehicle->id, 'driver_id' => $driver->id],
                [
                    'status' => $data['session_status'],
                    'source' => 'mobile_gps',
                    'started_at' => $lastPingAt->copy()->subMinutes(count($data['trail']) * 2),
                    'ended_at' => $data['session_status'] === 'ended' ? $lastPingAt : null,
                    'consent_accepted_at' => $lastPingAt->copy()->subHours(1),
                    'last_ping_at' => $lastPingAt,
                    'creator_id' => $companyId,
                    'created_by' => $companyId,
                ]
            );

            LocationPing::where('vehicle_id', $vehicle->id)->delete();

            $lastPing = null;
            $steps = count($data['trail']);

            foreach ($data['trail'] as $index => $point) {
                $lastPing = LocationPing::create([
                    'tracking_session_id' => $session->id,
                    'vehicle_id' => $vehicle->id,
                    'driver_id' => $driver->id,
                    'latitude' => $point[0],
                    'longitude' => $point[1],
                    'accuracy' => 12.5,
                    'speed' => 34.0,
                    'heading' => 90.0,
                    'battery' => max(35, 95 - $index * 2),
                    'source' => 'mobile_gps',
                    'recorded_at' => $lastPingAt->copy()->subMinutes(($steps - 1 - $index) * 2),
                    'creator_id' => $companyId,
                    'created_by' => $companyId,
                ]);
            }

            if ($lastPing) {
                $vehicle->update([
                    'last_latitude' => $lastPing->latitude,
                    'last_longitude' => $lastPing->longitude,
                    'last_accuracy' => $lastPing->accuracy,
                    'last_speed' => $lastPing->speed,
                    'last_heading' => $lastPing->heading,
                    'last_source' => 'mobile_gps',
                    'last_ping_at' => $lastPing->recorded_at,
                    'last_location_ping_id' => $lastPing->id,
                ]);
            }
        }

        $this->command?->info('Fleet tracking demo data seeded for company ID '.$companyId.'.');
    }

    /**
     * Build a deterministic drifting trail of coordinates around an origin.
     *
     * @return array<int, array{0: float, 1: float}>
     */
    private function trail(float $lat, float $lng, int $steps, float $spread): array
    {
        $points = [];

        for ($i = 0; $i < $steps; $i++) {
            $points[] = [
                round($lat + sin($i / 3) * $spread * ($i / $steps + 0.4), 7),
                round($lng + cos($i / 4) * $spread * ($i / $steps + 0.4), 7),
            ];
        }

        return $points;
    }
}
