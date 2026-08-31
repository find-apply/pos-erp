<?php

namespace Tests\Feature\FleetTracking;

use App\Http\Middleware\PlanModuleCheck;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;
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

    public function test_it_deletes_a_vehicle_and_cascades_history(): void
    {
        [$company, $driver, $vehicle] = $this->fleet();

        $service = app(FleetTrackingService::class);
        $service->startSession($driver, $company->id, $vehicle->id);
        $service->recordMobilePing($driver, $company->id, [
            'latitude' => 36.7525,
            'longitude' => 3.0419,
        ]);
        $service->stopSession($driver, $company->id);

        $service->deleteVehicle($vehicle);

        $this->assertDatabaseMissing('vehicles', ['id' => $vehicle->id]);
        $this->assertDatabaseMissing('vehicle_assignments', ['vehicle_id' => $vehicle->id]);
        $this->assertDatabaseMissing('tracking_sessions', ['vehicle_id' => $vehicle->id]);
        $this->assertDatabaseMissing('location_pings', ['vehicle_id' => $vehicle->id]);
    }

    public function test_it_blocks_vehicle_delete_while_a_session_is_active(): void
    {
        [$company, $driver, $vehicle] = $this->fleet();

        $service = app(FleetTrackingService::class);
        $service->startSession($driver, $company->id, $vehicle->id);

        try {
            $service->deleteVehicle($vehicle);
            $this->fail('Expected ValidationException was not thrown.');
        } catch (ValidationException) {
            // expected
        }

        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id]);
    }

    public function test_it_ends_an_active_assignment(): void
    {
        [, , $vehicle] = $this->fleet();

        $service = app(FleetTrackingService::class);
        $assignment = $vehicle->activeAssignment()->first();

        $ended = $service->endAssignment($assignment);

        $this->assertSame('completed', $ended->status);
        $this->assertNotNull($ended->ends_at);
    }

    public function test_vehicles_page_renders_for_an_authorized_user(): void
    {
        [$company] = $this->fleet();

        $this->givePermissions($company, ['manage-vehicles']);
        $this->withoutMiddleware(PlanModuleCheck::class);

        $this->actingAs($company)
            ->get(route('fleet-tracking.vehicles.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('FleetTracking/Vehicles/Index', false)
                ->has('vehicles', 1, fn (AssertableInertia $vehicle) => $vehicle
                    ->has('active_assignment')
                    ->missing('gps_device_token')
                    ->etc())
                ->where('can.manage_vehicles', true)
                // Intake config moved to its own page and must not be re-added
                // here, or the registry ends up buried under it again.
                ->missing('device_endpoint'));
    }

    public function test_intake_settings_page_carries_only_configuration(): void
    {
        [$company] = $this->fleet();

        $this->givePermissions($company, ['manage-vehicles']);
        $this->withoutMiddleware(PlanModuleCheck::class);

        $this->actingAs($company)
            ->get(route('fleet-tracking.settings'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('FleetTracking/Settings', false)
                ->has('device_endpoint')
                ->missing('vehicles')
                ->missing('drivers'));
    }

    public function test_singular_setting_url_redirects_to_settings(): void
    {
        [$company] = $this->users();

        $this->givePermissions($company, ['manage-vehicles']);
        $this->withoutMiddleware(PlanModuleCheck::class);

        $this->actingAs($company)
            ->get('/fleet-tracking/setting')
            ->assertRedirect('/fleet-tracking/settings');
    }

    public function test_vehicle_delete_requires_manage_vehicles_permission(): void
    {
        [$company, $driver, $vehicle] = $this->fleet();

        $this->givePermissions($driver, ['track-own-location']);
        $this->withoutMiddleware(PlanModuleCheck::class);

        $this->actingAs($driver)
            ->delete(route('fleet-tracking.vehicles.destroy', $vehicle->id))
            ->assertRedirect();

        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id]);
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

    /** A Traccar forward payload for the given device. */
    private function traccarPayload(string $uniqueId, array $position = []): array
    {
        return [
            'position' => array_merge([
                'latitude' => 36.7486698,
                'longitude' => 3.05441,
                'speed' => 27.0,
                'course' => 135.0,
                'accuracy' => 5.0,
                'valid' => true,
                'fixTime' => '2026-08-29T11:59:58Z',
                'attributes' => ['batteryLevel' => 87],
            ], $position),
            'device' => ['uniqueId' => $uniqueId],
        ];
    }

    private function traccarVehicle(User $company, string $uniqueId = '860123456789012')
    {
        return app(FleetTrackingService::class)->createVehicle([
            'name' => 'Traccar Van',
            'plate_number' => '16-999-001',
            'vehicle_type' => 'van',
            'status' => 'active',
            'traccar_unique_id' => $uniqueId,
        ], $company->id, $company->id);
    }

    public function test_it_converts_traccar_speed_from_knots_to_kmh(): void
    {
        [$company] = $this->users();
        $vehicle = $this->traccarVehicle($company);

        $ping = app(FleetTrackingService::class)
            ->recordTraccarPosition($this->traccarPayload('860123456789012'));

        // 27 knots * 1.852 = 50.004 km/h, which the UI renders as km/h.
        $this->assertSame(50.0, round((float) $ping->speed, 2));
        $this->assertSame(135.0, (float) $ping->heading);
        $this->assertSame(87, (int) $ping->battery);
        $this->assertSame(FleetTrackingService::TRACCAR_SOURCE, $ping->source);
        $this->assertSame($vehicle->id, $ping->vehicle_id);
    }

    public function test_it_records_a_traccar_position_without_an_open_session(): void
    {
        [$company] = $this->users();
        $vehicle = $this->traccarVehicle($company);

        $ping = app(FleetTrackingService::class)
            ->recordTraccarPosition($this->traccarPayload('860123456789012'));

        // A tracker wired to the van reports whether or not anyone is driving.
        $this->assertNull($ping->tracking_session_id);
        $this->assertNull($ping->driver_id);
        $this->assertSame((float) $vehicle->fresh()->last_latitude, (float) $ping->latitude);
        $this->assertSame(FleetTrackingService::TRACCAR_SOURCE, $vehicle->fresh()->last_source);
    }

    public function test_it_attributes_a_traccar_position_to_the_driver_on_an_open_session(): void
    {
        [$company, $driver] = $this->users();
        $vehicle = $this->traccarVehicle($company);

        $service = app(FleetTrackingService::class);
        $service->createAssignment([
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ], $company->id, $company->id);
        $service->startSession($driver, $company->id);

        $ping = $service->recordTraccarPosition($this->traccarPayload('860123456789012'));

        $this->assertSame($driver->id, $ping->driver_id);
        $this->assertNotNull($ping->tracking_session_id);
    }

    public function test_it_prefers_fix_time_over_arrival_time(): void
    {
        [$company] = $this->users();
        $this->traccarVehicle($company);

        $ping = app(FleetTrackingService::class)->recordTraccarPosition(
            $this->traccarPayload('860123456789012', [
                'fixTime' => '2026-08-29T10:00:00Z',
                'deviceTime' => '2026-08-29T10:00:30Z',
                'serverTime' => '2026-08-29T10:01:00Z',
            ])
        );

        $this->assertSame('2026-08-29 10:00:00', $ping->recorded_at->utc()->format('Y-m-d H:i:s'));
    }

    public function test_it_rejects_a_position_for_an_unknown_device(): void
    {
        [$company] = $this->users();
        $this->traccarVehicle($company);

        $this->expectException(ValidationException::class);

        app(FleetTrackingService::class)->recordTraccarPosition($this->traccarPayload('does-not-exist'));
    }

    public function test_it_rejects_a_position_traccar_marked_invalid(): void
    {
        [$company] = $this->users();
        $this->traccarVehicle($company);

        $this->expectException(ValidationException::class);

        app(FleetTrackingService::class)
            ->recordTraccarPosition($this->traccarPayload('860123456789012', ['valid' => false]));
    }

    public function test_traccar_endpoint_rejects_a_wrong_secret(): void
    {
        [$company] = $this->users();
        $this->traccarVehicle($company);

        $this->withoutMiddleware(PlanModuleCheck::class)
            ->postJson(route('fleet-tracking.traccar.positions'), $this->traccarPayload('860123456789012'), [
                'X-Traccar-Secret' => 'not-the-secret',
            ])
            ->assertStatus(401);

        $this->assertDatabaseCount('location_pings', 0);
    }

    public function test_traccar_endpoint_accepts_the_company_secret(): void
    {
        [$company] = $this->users();
        $this->traccarVehicle($company);

        $secret = app(FleetTrackingService::class)->traccarSecret($company->id);

        $this->withoutMiddleware(PlanModuleCheck::class)
            ->postJson(route('fleet-tracking.traccar.positions'), $this->traccarPayload('860123456789012'), [
                'X-Traccar-Secret' => $secret,
            ])
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertDatabaseCount('location_pings', 1);
    }

    public function test_one_company_secret_cannot_move_another_companys_vehicle(): void
    {
        [$companyA] = $this->users();
        $this->traccarVehicle($companyA);

        $companyB = User::create([
            'name' => 'Other Fleet',
            'email' => 'other-fleet@example.test',
            'password' => 'password',
            'type' => 'company',
            'email_verified_at' => now(),
        ]);

        $secretB = app(FleetTrackingService::class)->traccarSecret($companyB->id);

        // The vehicle belongs to A, so only A's secret may write to it.
        $this->withoutMiddleware(PlanModuleCheck::class)
            ->postJson(route('fleet-tracking.traccar.positions'), $this->traccarPayload('860123456789012'), [
                'X-Traccar-Secret' => $secretB,
            ])
            ->assertStatus(401);

        $this->assertDatabaseCount('location_pings', 0);
    }

    public function test_blank_traccar_ids_do_not_collide_on_the_unique_index(): void
    {
        [$company] = $this->users();
        $service = app(FleetTrackingService::class);

        foreach (['16-111-001', '16-111-002'] as $plate) {
            $service->createVehicle([
                'name' => 'Van '.$plate,
                'plate_number' => $plate,
                'vehicle_type' => 'van',
                'status' => 'active',
                'traccar_unique_id' => '',
            ], $company->id, $company->id);
        }

        // Empty strings must land as NULL, or the second insert violates unique.
        $this->assertDatabaseCount('vehicles', 2);
        $this->assertDatabaseHas('vehicles', ['plate_number' => '16-111-002', 'traccar_unique_id' => null]);
    }

    public function test_the_traccar_secret_never_reaches_the_browser(): void
    {
        [$company] = $this->users();
        $this->givePermissions($company, ['manage-fleet-tracking', 'manage-vehicles']);

        $secret = app(FleetTrackingService::class)->traccarSecret($company->id);

        $response = $this->actingAs($company)
            ->withoutMiddleware(PlanModuleCheck::class)
            ->get(route('fleet-tracking.settings'))
            ->assertOk();

        // The settings page is allowed to show it; the shared settings blob,
        // which every page ships to every user, is not.
        $props = $response->viewData('page')['props'];

        $this->assertSame($secret, $props['traccar']['secret']);
        $this->assertArrayNotHasKey(
            FleetTrackingService::TRACCAR_SECRET_KEY,
            $props['companyAllSetting'] ?? []
        );
    }

    public function test_a_traccar_vehicle_reads_online_without_a_work_session(): void
    {
        [$company] = $this->users();
        $vehicle = $this->traccarVehicle($company);

        $service = app(FleetTrackingService::class);
        $service->recordTraccarPosition(
            $this->traccarPayload('860123456789012', ['fixTime' => now()->toIso8601String()])
        );

        // A fitted tracker has no session to open; going by the session would
        // pin it to "offline" while it is plainly still transmitting.
        $this->assertSame('online', $service->vehicleStatus($vehicle->fresh()));
    }

    public function test_a_mobile_vehicle_still_needs_a_session_to_read_online(): void
    {
        // fleet() builds its own company, driver and assignment.
        [$company, $driver, $vehicle] = $this->fleet('mobile-token-001');

        $service = app(FleetTrackingService::class);
        $service->startSession($driver, $company->id, $vehicle->id);
        $service->recordMobilePing($driver, $company->id, [
            'latitude' => 36.75,
            'longitude' => 3.05,
        ]);
        $service->stopSession($driver, $company->id);

        // Phone pings only mean something while the driver is on the clock.
        $this->assertSame('offline', $service->vehicleStatus($vehicle->fresh()));
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
