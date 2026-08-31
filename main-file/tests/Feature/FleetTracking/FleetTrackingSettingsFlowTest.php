<?php

namespace Tests\Feature\FleetTracking;

use App\Http\Middleware\PlanModuleCheck;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;
use Workdo\FleetTracking\Services\FleetTrackingService;

/**
 * Exercises the exact HTTP calls the settings-page modals make, so the dialogs
 * are verified against the real endpoints rather than the service layer only.
 */
class FleetTrackingSettingsFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_modal_flow_creates_a_vehicle(): void
    {
        $company = $this->company();

        $this->actingAs($company)
            ->post(route('fleet-tracking.vehicles.store'), [
                'name' => 'Van 01',
                'plate_number' => 'PLATE-1',
                'vehicle_type' => 'van',
                'status' => 'active',
                'gps_device_token' => 'TOKEN-1',
                'gps_device_name' => 'SIM Tracker',
                'airtag_reference' => '',
                'notes' => '',
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('vehicles', ['plate_number' => 'PLATE-1', 'created_by' => $company->id]);
    }

    public function test_duplicate_plate_returns_field_errors_the_modal_can_display(): void
    {
        $company = $this->company();
        $this->vehicle($company, 'PLATE-1', 'TOKEN-1');

        $this->actingAs($company)
            ->post(route('fleet-tracking.vehicles.store'), [
                'name' => 'Van 02',
                'plate_number' => 'PLATE-1',
                'vehicle_type' => 'van',
                'status' => 'active',
            ])
            ->assertSessionHasErrors('plate_number');

        $this->assertSame(1, \Workdo\FleetTracking\Models\Vehicle::count());
    }

    public function test_duplicate_device_token_returns_field_errors(): void
    {
        $company = $this->company();
        $this->vehicle($company, 'PLATE-1', 'TOKEN-1');

        $this->actingAs($company)
            ->post(route('fleet-tracking.vehicles.store'), [
                'name' => 'Van 02',
                'plate_number' => 'PLATE-2',
                'vehicle_type' => 'van',
                'status' => 'active',
                'gps_device_token' => 'TOKEN-1',
            ])
            ->assertSessionHasErrors('gps_device_token');
    }

    public function test_edit_modal_with_blank_token_keeps_the_stored_token(): void
    {
        $company = $this->company();
        $vehicle = $this->vehicle($company, 'PLATE-1', 'TOKEN-1');

        $this->actingAs($company)
            ->put(route('fleet-tracking.vehicles.update', $vehicle->id), [
                'name' => 'Renamed Van',
                'plate_number' => 'PLATE-1',
                'vehicle_type' => 'truck',
                'status' => 'maintenance',
                'gps_device_token' => '',
                'gps_device_name' => 'OBD Tracker',
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $vehicle->refresh();
        $this->assertSame('Renamed Van', $vehicle->name);
        $this->assertSame('TOKEN-1', $vehicle->gps_device_token);
        $this->assertSame('maintenance', $vehicle->status);
    }

    public function test_assignment_modal_flow_and_conflict_replacement(): void
    {
        $company = $this->company();
        $driver = $this->driver($company, 'driver-a@example.test');
        $vehicleA = $this->vehicle($company, 'PLATE-A');
        $vehicleB = $this->vehicle($company, 'PLATE-B');

        $this->actingAs($company)
            ->post(route('fleet-tracking.assignments.store'), [
                'vehicle_id' => $vehicleA->id,
                'driver_id' => $driver->id,
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        // Reassigning the same driver elsewhere must complete the first assignment,
        // which is exactly what the modal's amber warning tells the user.
        $this->actingAs($company)
            ->post(route('fleet-tracking.assignments.store'), [
                'vehicle_id' => $vehicleB->id,
                'driver_id' => $driver->id,
            ])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('vehicle_assignments', ['vehicle_id' => $vehicleA->id, 'status' => 'completed']);
        $this->assertDatabaseHas('vehicle_assignments', ['vehicle_id' => $vehicleB->id, 'status' => 'active']);
    }

    public function test_end_assignment_button_completes_the_assignment(): void
    {
        $company = $this->company();
        $driver = $this->driver($company, 'driver-b@example.test');
        $vehicle = $this->vehicle($company, 'PLATE-A');

        $assignment = app(FleetTrackingService::class)->createAssignment([
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ], $company->id, $company->id);

        $this->actingAs($company)
            ->put(route('fleet-tracking.assignments.end', $assignment->id))
            ->assertSessionHas('success');

        $this->assertSame('completed', $assignment->fresh()->status);
    }

    public function test_delete_button_removes_the_vehicle(): void
    {
        $company = $this->company();
        $vehicle = $this->vehicle($company, 'PLATE-A');

        $this->actingAs($company)
            ->delete(route('fleet-tracking.vehicles.destroy', $vehicle->id))
            ->assertSessionHas('success');

        $this->assertDatabaseMissing('vehicles', ['id' => $vehicle->id]);
    }

    public function test_delete_during_active_session_flashes_an_error_and_keeps_the_vehicle(): void
    {
        $company = $this->company();
        $driver = $this->driver($company, 'driver-c@example.test');
        $vehicle = $this->vehicle($company, 'PLATE-A');

        $service = app(FleetTrackingService::class);
        $service->createAssignment(['vehicle_id' => $vehicle->id, 'driver_id' => $driver->id], $company->id, $company->id);
        $service->startSession($driver, $company->id, $vehicle->id);

        $response = $this->actingAs($company)
            ->delete(route('fleet-tracking.vehicles.destroy', $vehicle->id));

        $response->assertSessionHas('error');
        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id]);
    }

    public function test_page_props_match_what_the_modals_read(): void
    {
        $company = $this->company();
        $driver = $this->driver($company, 'driver-d@example.test');
        $vehicle = $this->vehicle($company, 'PLATE-A', 'TOKEN-1');
        app(FleetTrackingService::class)->createAssignment(
            ['vehicle_id' => $vehicle->id, 'driver_id' => $driver->id],
            $company->id,
            $company->id,
        );

        $this->actingAs($company)
            ->get(route('fleet-tracking.vehicles.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('FleetTracking/Vehicles/Index', false)
                ->where('can.manage_vehicles', true)
                ->has('drivers')
                ->has('summary.total')
                ->has('vehicles', 1, fn (AssertableInertia $item) => $item
                    ->where('has_device_token', true)
                    ->missing('gps_device_token')
                    ->has('active_assignment', fn (AssertableInertia $assignment) => $assignment
                        ->where('status', 'active')
                        ->has('id')
                        ->has('driver_id')
                        ->has('starts_at')
                        ->has('driver.name')
                        ->etc())
                    ->etc()));
    }

    private function company(): User
    {
        $company = User::create([
            'name' => 'Fleet Company',
            'email' => 'flow-company@example.test',
            'password' => 'password',
            'type' => 'company',
            'email_verified_at' => now(),
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (['manage-vehicles', 'manage-fleet-tracking', 'track-own-location'] as $permission) {
            Permission::firstOrCreate(
                ['name' => $permission, 'guard_name' => 'web'],
                ['module' => 'fleet-tracking', 'label' => $permission, 'add_on' => 'FleetTracking'],
            );
        }
        $company->givePermissionTo(['manage-vehicles', 'manage-fleet-tracking']);

        $this->withoutMiddleware(PlanModuleCheck::class);

        return $company;
    }

    private function driver(User $company, string $email): User
    {
        $driver = User::create([
            'name' => 'Driver',
            'email' => $email,
            'password' => 'password',
            'type' => 'staff',
            'email_verified_at' => now(),
            'created_by' => $company->id,
        ]);

        $driver->givePermissionTo(['track-own-location']);

        return $driver;
    }

    private function vehicle(User $company, string $plate, ?string $token = null)
    {
        return app(FleetTrackingService::class)->createVehicle([
            'name' => 'Vehicle ' . $plate,
            'plate_number' => $plate,
            'vehicle_type' => 'van',
            'status' => 'active',
            'gps_device_token' => $token,
        ], $company->id, $company->id);
    }
}
