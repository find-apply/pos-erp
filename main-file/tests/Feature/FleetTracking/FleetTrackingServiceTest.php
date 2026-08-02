<?php

namespace Tests\Feature\FleetTracking;

use App\Http\Middleware\PlanModuleCheck;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;
use Workdo\FleetTracking\Services\FleetTrackingService;

class FleetTrackingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_vehicle_and_assigns_it_to_a_driver(): void
    {
        [$company, $driver] = $this->users();

        $service = app(FleetTrackingService::class);
        $vehicle = $service->createVehicle([
            'name' => 'Delivery Van 01',
            'plate_number' => '16-123-001',
            'vehicle_type' => 'van',
            'status' => 'active',
            'gps_device_token' => 'device-token-001',
        ], $company->id, $company->id);

        $assignment = $service->createAssignment([
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ], $company->id, $company->id);

        $this->assertDatabaseHas('vehicles', [
            'name' => 'Delivery Van 01',
            'plate_number' => '16-123-001',
            'created_by' => $company->id,
        ]);
        $this->assertSame('active', $assignment->status);
        $this->assertSame($driver->id, $assignment->driver_id);
    }

    public function test_it_updates_vehicle_device_settings_without_clearing_blank_token(): void
    {
        [$company, , $vehicle] = $this->fleet('old-token');

        $service = app(FleetTrackingService::class);
        $updated = $service->updateVehicle($vehicle, [
            'name' => 'Delivery Truck 02',
            'plate_number' => '16-123-002',
            'vehicle_type' => 'truck',
            'status' => 'maintenance',
            'gps_device_token' => '',
            'gps_device_name' => 'OBD Tracker',
            'airtag_reference' => 'TAG-002',
            'notes' => 'Updated device settings.',
        ]);

        $this->assertSame('Delivery Truck 02', $updated->name);
        $this->assertSame('old-token', $updated->gps_device_token);
        $this->assertSame('OBD Tracker', $updated->gps_device_name);
        $this->assertSame('TAG-002', $updated->airtag_reference);

        $updatedAgain = $service->updateVehicle($updated, [
            'name' => 'Delivery Truck 02',
            'plate_number' => '16-123-002',
            'vehicle_type' => 'truck',
            'status' => 'active',
            'gps_device_token' => 'new-token',
            'gps_device_name' => 'SIM Tracker',
            'airtag_reference' => 'TAG-002',
            'notes' => 'Updated token.',
        ]);

        $this->assertSame('new-token', $updatedAgain->gps_device_token);
        $this->assertSame('SIM Tracker', $updatedAgain->gps_device_name);
        $this->assertSame($company->id, $updatedAgain->created_by);
    }

    public function test_it_starts_and_stops_a_tracking_session(): void
    {
        [$company, $driver, $vehicle] = $this->fleet();

        $service = app(FleetTrackingService::class);
        $session = $service->startSession($driver, $company->id, $vehicle->id);

        $this->assertSame('active', $session->status);
        $this->assertNotNull($session->consent_accepted_at);

        $stopped = $service->stopSession($driver, $company->id);

        $this->assertSame('stopped', $stopped->status);
        $this->assertNotNull($stopped->ended_at);
    }

    public function test_it_accepts_a_mobile_ping_and_updates_the_vehicle_last_location(): void
    {
        [$company, $driver, $vehicle] = $this->fleet();

        $service = app(FleetTrackingService::class);
        $service->startSession($driver, $company->id, $vehicle->id);

        $ping = $service->recordMobilePing($driver, $company->id, [
            'latitude' => 36.7525,
            'longitude' => 3.0419,
            'accuracy' => 8,
            'speed' => 42,
            'heading' => 120,
            'battery' => 77,
        ]);

        $vehicle->refresh();

        $this->assertSame(FleetTrackingService::MOBILE_SOURCE, $ping->source);
        $this->assertSame(36.7525, (float) $vehicle->last_latitude);
        $this->assertSame(3.0419, (float) $vehicle->last_longitude);
        $this->assertSame('online', $service->vehicleStatus($vehicle));
    }

    public function test_it_rejects_mobile_ping_without_an_active_session(): void
    {
        [$company, $driver] = $this->users();

        $this->expectException(ValidationException::class);

        app(FleetTrackingService::class)->recordMobilePing($driver, $company->id, [
            'latitude' => 36.7525,
            'longitude' => 3.0419,
        ]);
    }

    public function test_it_marks_vehicle_as_stale_then_offline(): void
    {
        [$company, $driver, $vehicle] = $this->fleet();

        $service = app(FleetTrackingService::class);
        $service->startSession($driver, $company->id, $vehicle->id);
        $service->recordMobilePing($driver, $company->id, [
            'latitude' => 36.7525,
            'longitude' => 3.0419,
            'recorded_at' => now()->subMinutes(11)->toIso8601String(),
        ]);

        $this->assertSame('stale', $service->vehicleStatus($vehicle->fresh()));

        $service->stopSession($driver, $company->id);

        $this->assertSame('offline', $service->vehicleStatus($vehicle->fresh()));
    }

    public function test_device_endpoint_requires_a_valid_token_and_active_session(): void
    {
        [$company, $driver, $vehicle] = $this->fleet('gps-token-001');

        $service = app(FleetTrackingService::class);
        $service->startSession($driver, $company->id, $vehicle->id);

        $ping = $service->recordDevicePing([
            'device_token' => 'gps-token-001',
            'latitude' => 36.7525,
            'longitude' => 3.0419,
        ]);

        $this->assertSame(FleetTrackingService::DEVICE_SOURCE, $ping->source);

        $this->expectException(ValidationException::class);

        $service->recordDevicePing([
            'device_token' => 'bad-token',
            'latitude' => 36.7525,
            'longitude' => 3.0419,
        ]);
    }

    public function test_driver_can_view_own_tracking_page_but_not_another_driver_page(): void
    {
        [$company, $driver, $vehicle] = $this->fleet();
        $otherDriver = User::create([
            'name' => 'Other Driver',
            'email' => 'other-driver@example.test',
            'password' => 'password',
            'type' => 'staff',
            'email_verified_at' => now(),
            'created_by' => $company->id,
        ]);

        $this->givePermissions($driver, ['track-own-location']);
        $this->withoutMiddleware(PlanModuleCheck::class);

        $this->actingAs($driver)
            ->get(route('fleet-tracking.drivers.show', $driver->id))
            ->assertOk();

        $this->actingAs($driver)
            ->get(route('fleet-tracking.drivers.show', $otherDriver->id))
            ->assertRedirect();
    }

    private function fleet(?string $deviceToken = null): array
    {
        [$company, $driver] = $this->users();

        $service = app(FleetTrackingService::class);
        $vehicle = $service->createVehicle([
            'name' => 'Delivery Van 01',
            'plate_number' => '16-123-001',
            'vehicle_type' => 'van',
            'status' => 'active',
            'gps_device_token' => $deviceToken,
        ], $company->id, $company->id);

        $service->createAssignment([
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ], $company->id, $company->id);

        return [$company, $driver, $vehicle];
    }

    private function users(): array
    {
        $company = User::create([
            'name' => 'Fleet Company',
            'email' => 'fleet-company@example.test',
            'password' => 'password',
            'type' => 'company',
            'email_verified_at' => now(),
        ]);

        $driver = User::create([
            'name' => 'Driver One',
            'email' => 'driver-one@example.test',
            'password' => 'password',
            'type' => 'staff',
            'email_verified_at' => now(),
            'created_by' => $company->id,
        ]);

        return [$company, $driver];
    }

    private function givePermissions(User $user, array $permissions): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ], [
                'module' => 'fleet-tracking',
                'label' => $permission,
                'add_on' => 'FleetTracking',
            ]);
        }

        $user->givePermissionTo($permissions);
    }
}
