<?php

namespace Tests\Feature\Distribution;

use App\Http\Middleware\PlanModuleCheck;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\DeliveryRound;
use Workdo\Distribution\Models\Driver;
use Workdo\Distribution\Models\DriverCashMovement;
use Workdo\Distribution\Models\DriverStock;
use Workdo\Distribution\Models\DriverStockMovement;
use Workdo\Distribution\Services\DistributionService;
use Workdo\Distribution\Services\DriverPortalService;
use Workdo\Distribution\Services\DriverService;

class DistributionModuleTest extends TestCase
{
    use RefreshDatabase;

    private const PERMISSIONS = [
        'manage-distribution',
        'view-distribution',
        'manage-distribution-drivers',
        'manage-delivery-notes',
        'manage-delivery-rounds',
        'view-distribution-map',
        'view-distribution-performance',
    ];

    private User $company;
    private User $driver;

    protected function setUp(): void
    {
        parent::setUp();

        // The module gate is exercised by its own middleware test elsewhere;
        // these cases are about the distribution behaviour itself.
        $this->withoutMiddleware(PlanModuleCheck::class);

        $this->company = User::create([
            'name' => 'Distribution Company',
            'email' => 'distribution-company@example.test',
            'password' => 'password',
            'type' => 'company',
            'email_verified_at' => now(),
        ]);
        $this->company->created_by = $this->company->id;
        $this->company->save();

        $this->driver = User::create([
            'name' => 'Driver One',
            'email' => 'distribution-driver@example.test',
            'password' => 'password',
            'type' => 'staff',
            'email_verified_at' => now(),
            'created_by' => $this->company->id,
        ]);

        $this->givePermissions($this->company, self::PERMISSIONS);
    }

    private function givePermissions(User $user, array $permissions): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ($permissions as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ], [
                'module' => 'distribution',
                'label' => $permission,
                'add_on' => 'Distribution',
            ]);
        }

        $user->givePermissionTo($permissions);
    }

    private function otherCompany(string $email): User
    {
        $user = User::create([
            'name' => 'Other Company',
            'email' => $email,
            'password' => 'password',
            'type' => 'company',
            'email_verified_at' => now(),
        ]);
        $user->created_by = $user->id;
        $user->save();

        return $user;
    }

    private function note(array $attributes = []): DeliveryNote
    {
        return DeliveryNote::create(array_merge([
            'driver_id' => $this->driver->id,
            'status' => DeliveryNote::STATUS_PENDING,
            'scheduled_date' => today(),
            'total_amount' => 1000,
            'collected_amount' => 0,
            'creator_id' => $this->company->id,
            'created_by' => $this->company->id,
        ], $attributes));
    }

    public function test_todays_collection_counts_cash_taken_on_partial_deliveries(): void
    {
        $this->note([
            'status' => DeliveryNote::STATUS_DELIVERED,
            'delivered_at' => now(),
            'total_amount' => 15000,
            'collected_amount' => 15000,
        ]);
        $this->note([
            'status' => DeliveryNote::STATUS_PARTIAL,
            'delivered_at' => now(),
            'total_amount' => 12000,
            'collected_amount' => 5000,
        ]);

        $summary = app(DistributionService::class)->dashboard($this->company->id)['summary'];

        // Both notes were dropped today, so "today" and "total" must agree -
        // the partial's 5 000 used to be missing from today but present in total.
        $this->assertSame(20000.0, (float) $summary['collected_today']);
        $this->assertSame(20000.0, (float) $summary['collected_total']);
        $this->assertSame(2, $summary['delivered_today']);
        $this->assertSame(7000.0, (float) $summary['receivables']);
    }

    public function test_todays_collection_ignores_drops_made_on_another_day(): void
    {
        $this->note([
            'status' => DeliveryNote::STATUS_PARTIAL,
            'delivered_at' => now()->subDay(),
            'total_amount' => 12000,
            'collected_amount' => 5000,
        ]);

        $summary = app(DistributionService::class)->dashboard($this->company->id)['summary'];

        $this->assertSame(0.0, (float) $summary['collected_today']);
        $this->assertSame(0, $summary['delivered_today']);
        // Still counted in the running total and in what the customer owes.
        $this->assertSame(5000.0, (float) $summary['collected_total']);
        $this->assertSame(7000.0, (float) $summary['receivables']);
    }

    public function test_the_hub_renders_for_an_authorised_company(): void
    {
        $this->actingAs($this->company)
            ->get(route('distribution.index'))
            ->assertOk();
    }

    public function test_every_distribution_screen_renders(): void
    {
        foreach ([
            'distribution.index',
            'distribution.drivers',
            'distribution.rounds',
            'distribution.delivery-notes',
            'distribution.map',
            'distribution.performance',
        ] as $name) {
            $this->actingAs($this->company)->get(route($name))->assertOk();
        }
    }

    public function test_receivables_count_only_what_was_billed_but_not_collected(): void
    {
        $this->note(['status' => DeliveryNote::STATUS_DELIVERED, 'total_amount' => 15000, 'collected_amount' => 15000]);
        $this->note(['status' => DeliveryNote::STATUS_PARTIAL, 'total_amount' => 12000, 'collected_amount' => 5000]);
        // Still pending, so nothing is owed yet and it must not reach receivables.
        $this->note(['total_amount' => 8500]);

        $summary = app(DistributionService::class)->dashboard($this->company->id)['summary'];

        $this->assertSame(7000.0, $summary['receivables']);
        $this->assertSame(20000.0, $summary['collected_total']);
        $this->assertSame(1, $summary['notes_pending']);
    }

    public function test_average_minutes_ignores_notes_delivered_outside_a_round(): void
    {
        $round = DeliveryRound::create([
            'reference' => 'TRN-1',
            'driver_id' => $this->driver->id,
            'round_date' => today(),
            'status' => DeliveryRound::STATUS_IN_PROGRESS,
            'started_at' => now()->subHours(2),
            'creator_id' => $this->company->id,
            'created_by' => $this->company->id,
        ]);

        $this->note([
            'status' => DeliveryNote::STATUS_DELIVERED,
            'round_id' => $round->id,
            'delivered_at' => now(),
        ]);

        // No round, so there is no start time to measure from - it must be
        // skipped rather than counted as a zero-minute delivery.
        $this->note(['status' => DeliveryNote::STATUS_DELIVERED, 'delivered_at' => now()]);

        $totals = app(DistributionService::class)->performance($this->company->id)['totals'];

        $this->assertSame(120, $totals['average_minutes']);
        $this->assertSame(2, $totals['deliveries']);
    }

    public function test_driver_stats_report_a_success_rate(): void
    {
        $this->note(['status' => DeliveryNote::STATUS_DELIVERED, 'collected_amount' => 500]);
        $this->note(['status' => DeliveryNote::STATUS_FAILED]);

        $stats = app(DistributionService::class)->driverStats($this->company->id)
            ->firstWhere('id', $this->driver->id);

        $this->assertSame(2, $stats['total']);
        $this->assertSame(1, $stats['delivered']);
        $this->assertSame(1, $stats['failed']);
        $this->assertSame(50, $stats['success_rate']);
    }

    public function test_map_points_skip_delivery_notes_without_coordinates(): void
    {
        $this->note(['latitude' => 36.75, 'longitude' => 3.05]);
        $this->note();

        $points = app(DistributionService::class)->mapPoints($this->company->id);

        $this->assertCount(1, $points);
    }

    public function test_another_company_cannot_see_these_delivery_notes(): void
    {
        $this->note(['status' => DeliveryNote::STATUS_DELIVERED, 'collected_amount' => 900]);

        $other = $this->otherCompany('distribution-other@example.test');

        $summary = app(DistributionService::class)->dashboard($other->id)['summary'];

        $this->assertSame(0, $summary['notes_pending']);
        $this->assertSame(0.0, $summary['collected_total']);
    }

    public function test_the_performance_window_rejects_an_arbitrary_value(): void
    {
        $this->actingAs($this->company)
            ->get(route('distribution.performance', ['days' => 9999]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('window_days', 30));
    }


    private function makeDriver(array $overrides = []): Driver
    {
        return app(DriverService::class)->create(array_merge([
            'name' => 'Karim Livreur',
            'phone' => '0555112233',
            'code' => '',
            'access_code' => '',
            'vehicle_label' => 'Renault Kangoo',
            'allow_credit' => true,
            'max_discount_type' => 'percent',
            'max_discount_value' => 5,
        ], $overrides), $this->company->id, $this->company->id);
    }

    public function test_creating_a_driver_also_creates_the_staff_user_behind_it(): void
    {
        $driver = $this->makeDriver();

        $this->assertSame('LIV-001', $driver->code);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $driver->access_code);
        $this->assertNotNull($driver->user_id);
        $this->assertSame('staff', $driver->user->type);
        $this->assertSame($this->company->id, (int) $driver->user->created_by);
        // The access code is the credential, so it must be what the user's
        // password hashes to.
        $this->assertTrue(Hash::check($driver->access_code, $driver->user->password));
    }

    public function test_driver_codes_increment_per_company(): void
    {
        $this->makeDriver();
        $second = $this->makeDriver(['phone' => '0555999888']);

        $this->assertSame('LIV-002', $second->code);
    }

    public function test_regenerating_the_access_code_keeps_the_password_in_step(): void
    {
        $driver = $this->makeDriver();
        $original = $driver->access_code;

        $updated = app(DriverService::class)->regenerateAccessCode($driver);

        $this->assertNotSame($original, $updated->access_code);
        $this->assertTrue(Hash::check($updated->access_code, $updated->user->fresh()->password));
    }

    public function test_a_duplicate_access_code_is_rejected(): void
    {
        $existing = $this->makeDriver();

        $this->actingAs($this->company)
            ->from(route('distribution.drivers'))
            ->post(route('distribution.drivers.store'), [
                'name' => 'Second Driver',
                'phone' => '0555000000',
                'access_code' => $existing->access_code,
                'max_discount_type' => 'percent',
                'max_discount_value' => 0,
            ])
            ->assertSessionHasErrors('access_code');

        $this->assertSame(1, Driver::count());
    }

    public function test_deleting_a_driver_with_deliveries_keeps_the_user(): void
    {
        $driver = $this->makeDriver();
        $userId = $driver->user_id;

        $this->note(['driver_id' => $userId, 'status' => DeliveryNote::STATUS_DELIVERED]);

        app(DriverService::class)->delete($driver);

        $this->assertNull(Driver::find($driver->id));
        // The delivery still has to say who made it.
        $this->assertNotNull(User::find($userId));
    }

    public function test_deleting_a_driver_without_deliveries_removes_the_user(): void
    {
        $driver = $this->makeDriver();
        $userId = $driver->user_id;

        app(DriverService::class)->delete($driver);

        $this->assertNull(Driver::find($driver->id));
        $this->assertNull(User::find($userId));
    }

    public function test_a_driver_from_another_company_cannot_be_edited(): void
    {
        $driver = $this->makeDriver();
        $stranger = $this->otherCompany('driver-stranger@example.test');
        $this->givePermissions($stranger, self::PERMISSIONS);

        $this->actingAs($stranger)
            ->put(route('distribution.drivers.update', $driver->id), [
                'name' => 'Hijacked',
                'phone' => '0000',
                'max_discount_type' => 'percent',
                'max_discount_value' => 0,
            ])
            ->assertRedirect(route('distribution.drivers'));

        $this->assertSame('Karim Livreur', $driver->fresh()->name);
    }


    public function test_a_driver_signs_in_with_phone_and_access_code(): void
    {
        $driver = $this->makeDriver();

        $this->post(route('distribution.driver.access.login'), [
            'phone' => $driver->phone,
            'access_code' => $driver->access_code,
        ])->assertRedirect(route('distribution.driver.home'));

        $this->assertAuthenticatedAs($driver->user);
    }

    public function test_a_wrong_access_code_does_not_sign_anyone_in(): void
    {
        $driver = $this->makeDriver();

        $this->from(route('distribution.driver.access'))
            ->post(route('distribution.driver.access.login'), [
                'phone' => $driver->phone,
                'access_code' => '000000',
            ])
            ->assertSessionHasErrors('access_code');

        $this->assertGuest();
    }

    public function test_an_inactive_driver_cannot_sign_in(): void
    {
        $driver = $this->makeDriver();
        $driver->update(['status' => Driver::STATUS_INACTIVE]);

        $this->from(route('distribution.driver.access'))
            ->post(route('distribution.driver.access.login'), [
                'phone' => $driver->phone,
                'access_code' => $driver->access_code,
            ])
            ->assertSessionHasErrors('access_code');

        $this->assertGuest();
    }

    public function test_repeated_wrong_codes_are_rate_limited(): void
    {
        $driver = $this->makeDriver();

        // The fifth failure trips the limiter; the sixth is refused outright,
        // which is what stops a six-digit code being walked through.
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->from(route('distribution.driver.access'))
                ->post(route('distribution.driver.access.login'), [
                    'phone' => $driver->phone,
                    'access_code' => '000000',
                ]);
        }

        $response = $this->from(route('distribution.driver.access'))
            ->post(route('distribution.driver.access.login'), [
                'phone' => $driver->phone,
                // Even the *correct* code is refused while locked out.
                'access_code' => $driver->access_code,
            ]);

        $response->assertSessionHasErrors('access_code');
        $this->assertGuest();
    }

    public function test_completing_a_delivery_credits_the_drivers_cash_box(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 9000]);

        $this->actingAs($driver->user)
            ->put(route('distribution.driver.notes.complete', $note->id), [
                'status' => DeliveryNote::STATUS_DELIVERED,
                'collected_amount' => 9000,
                'recipient_name' => 'Dr. Samira',
            ]);

        $this->assertSame('9000.00', $driver->fresh()->cash_balance);
        $this->assertSame(DeliveryNote::STATUS_DELIVERED, $note->fresh()->status);
        $this->assertNotNull($note->fresh()->delivered_at);
    }

    public function test_recompleting_a_delivery_adjusts_the_cash_box_by_the_difference(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 9000]);

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 9000,
        ]);

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_PARTIAL,
            'collected_amount' => 5000,
        ]);

        // Not 14000 - the second submission replaces the first.
        $this->assertSame('5000.00', $driver->fresh()->cash_balance);
    }

    public function test_a_failed_delivery_collects_nothing_even_if_an_amount_is_sent(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 9000]);

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_FAILED,
            'collected_amount' => 9000,
            'failure_reason' => 'Closed',
        ]);

        $this->assertSame('0.00', $driver->fresh()->cash_balance);
        $this->assertSame('0.00', $note->fresh()->collected_amount);
        $this->assertNull($note->fresh()->delivered_at);
    }

    public function test_round_tracking_lists_stops_in_delivery_order(): void
    {
        $round = DeliveryRound::create([
            'reference' => 'TRN-TRACK', 'round_date' => today(), 'driver_id' => $this->driver->id,
            'status' => DeliveryRound::STATUS_IN_PROGRESS,
            'creator_id' => $this->company->id, 'created_by' => $this->company->id,
        ]);

        // Inserted out of order on purpose; sequence is what decides.
        $second = $this->note(['round_id' => $round->id, 'sequence' => 2, 'latitude' => 36.75, 'longitude' => 3.06]);
        $first = $this->note(['round_id' => $round->id, 'sequence' => 1, 'latitude' => 36.47, 'longitude' => 2.83]);
        // No customer pin: still listed, just not drawable.
        $third = $this->note(['round_id' => $round->id, 'sequence' => 3]);

        $tracking = app(DistributionService::class)->roundTracking($round->fresh());

        $this->assertSame([$first->id, $second->id, $third->id], $tracking['stops']->pluck('id')->all());
        $this->assertSame([1, 2, 3], $tracking['stops']->pluck('order')->all());
        $this->assertNull($tracking['stops'][2]['latitude']);
    }

    public function test_round_tracking_reports_no_vehicle_when_the_driver_has_none(): void
    {
        $round = DeliveryRound::create([
            'reference' => 'TRN-NOVAN', 'round_date' => today(), 'driver_id' => $this->driver->id,
            'status' => DeliveryRound::STATUS_PLANNED,
            'creator_id' => $this->company->id, 'created_by' => $this->company->id,
        ]);

        // The common reason the car never shows up on the map.
        $this->assertNull(app(DistributionService::class)->roundTracking($round)['vehicle']);
    }

    public function test_another_company_cannot_track_this_round(): void
    {
        $round = DeliveryRound::create([
            'reference' => 'TRN-MINE', 'round_date' => today(), 'driver_id' => $this->driver->id,
            'status' => DeliveryRound::STATUS_PLANNED,
            'creator_id' => $this->company->id, 'created_by' => $this->company->id,
        ]);

        $intruder = $this->otherCompany('rival-tracker@example.test');
        $this->givePermissions($intruder, ['manage-delivery-rounds']);

        $this->actingAs($intruder)
            ->getJson(route('distribution.rounds.track', $round->id))
            ->assertForbidden();
    }

    public function test_collecting_a_debt_fills_the_oldest_note_first(): void
    {
        $driver = $this->makeDriver();

        $older = $this->note([
            'driver_id' => $driver->user_id, 'customer_id' => 77,
            'status' => DeliveryNote::STATUS_PARTIAL,
            'scheduled_date' => today()->subDays(3),
            'total_amount' => 5000, 'collected_amount' => 1000,
        ]);
        $newer = $this->note([
            'driver_id' => $driver->user_id, 'customer_id' => 77,
            'status' => DeliveryNote::STATUS_DELIVERED,
            'scheduled_date' => today(),
            'total_amount' => 3000, 'collected_amount' => 0,
        ]);

        // 7 000 outstanding; 5 000 clears the older note and spills 1 000 over.
        $this->actingAs($driver->user)
            ->post(route('distribution.driver.collect'), ['customer_id' => 77, 'amount' => 5000])
            ->assertSessionHasNoErrors();

        $this->assertSame('5000.00', $older->fresh()->collected_amount);
        $this->assertSame('1000.00', $newer->fresh()->collected_amount);
        $this->assertSame('5000.00', $driver->fresh()->cash_balance);

        // One movement per note, so the trail says which delivery was settled.
        $this->assertDatabaseHas('driver_cash_movements', [
            'driver_id' => $driver->id, 'delivery_note_id' => $older->id, 'amount' => 4000,
        ]);
        $this->assertDatabaseHas('driver_cash_movements', [
            'driver_id' => $driver->id, 'delivery_note_id' => $newer->id, 'amount' => 1000,
        ]);
    }

    public function test_collecting_leaves_the_delivery_status_alone(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note([
            'driver_id' => $driver->user_id, 'customer_id' => 78,
            'status' => DeliveryNote::STATUS_PARTIAL,
            'total_amount' => 2000, 'collected_amount' => 500,
        ]);

        $this->actingAs($driver->user)
            ->post(route('distribution.driver.collect'), ['customer_id' => 78, 'amount' => 1500]);

        // Status describes how the delivery went, not whether it was paid for.
        $this->assertSame(DeliveryNote::STATUS_PARTIAL, $note->fresh()->status);
        $this->assertSame('2000.00', $note->fresh()->collected_amount);
    }

    public function test_a_driver_cannot_collect_more_than_is_owed(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note([
            'driver_id' => $driver->user_id, 'customer_id' => 79,
            'status' => DeliveryNote::STATUS_DELIVERED,
            'total_amount' => 1000, 'collected_amount' => 400,
        ]);

        $this->actingAs($driver->user)
            ->post(route('distribution.driver.collect'), ['customer_id' => 79, 'amount' => 601])
            ->assertSessionHasErrors('amount');

        $this->assertSame('400.00', $note->fresh()->collected_amount);
        $this->assertSame('0.00', $driver->fresh()->cash_balance);
    }

    public function test_a_driver_cannot_collect_against_another_drivers_notes(): void
    {
        $mine = $this->makeDriver();
        $theirs = $this->makeDriver(['name' => 'Samia', 'phone' => '0555998877']);

        $note = $this->note([
            'driver_id' => $theirs->user_id, 'customer_id' => 80,
            'status' => DeliveryNote::STATUS_DELIVERED,
            'total_amount' => 4000, 'collected_amount' => 0,
        ]);

        $this->actingAs($mine->user)
            ->post(route('distribution.driver.collect'), ['customer_id' => 80, 'amount' => 4000])
            ->assertSessionHasErrors('amount');

        $this->assertSame('0.00', $note->fresh()->collected_amount);
        $this->assertSame('0.00', $mine->fresh()->cash_balance);
    }

    public function test_a_settled_customer_drops_off_the_debt_list(): void
    {
        $driver = $this->makeDriver();
        $this->note([
            'driver_id' => $driver->user_id, 'customer_id' => 81,
            'status' => DeliveryNote::STATUS_DELIVERED,
            'total_amount' => 2500, 'collected_amount' => 2500,
        ]);
        $open = $this->note([
            'driver_id' => $driver->user_id, 'customer_id' => 81,
            'status' => DeliveryNote::STATUS_DELIVERED,
            'total_amount' => 1500, 'collected_amount' => 0,
        ]);

        // The count is of unpaid notes, not of every note the customer has had.
        $before = app(DriverPortalService::class)->receivables($driver);
        $this->assertSame(1, $before->first()['notes']);
        $this->assertSame(1500.0, $before->first()['debt']);

        $this->actingAs($driver->user)
            ->post(route('distribution.driver.collect'), ['customer_id' => 81, 'amount' => 1500]);

        $this->assertSame('1500.00', $open->fresh()->collected_amount);
        $this->assertCount(0, app(DriverPortalService::class)->receivables($driver->fresh()));
    }

    public function test_a_driver_cannot_complete_another_drivers_delivery(): void
    {
        $mine = $this->makeDriver();
        $theirs = $this->makeDriver(['phone' => '0555777666']);

        $note = $this->note(['driver_id' => $theirs->user_id, 'total_amount' => 4000]);

        $this->actingAs($mine->user)
            ->put(route('distribution.driver.notes.complete', $note->id), [
                'status' => DeliveryNote::STATUS_DELIVERED,
                'collected_amount' => 4000,
            ])
            ->assertRedirect(route('distribution.driver.access'));

        $this->assertSame(DeliveryNote::STATUS_PENDING, $note->fresh()->status);
        $this->assertSame('0.00', $mine->fresh()->cash_balance);
    }

    public function test_collecting_more_than_the_note_is_worth_is_rejected(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 9000]);

        $this->actingAs($driver->user)
            ->from(route('distribution.driver.home'))
            ->put(route('distribution.driver.notes.complete', $note->id), [
                'status' => DeliveryNote::STATUS_DELIVERED,
                'collected_amount' => 12000,
            ])
            ->assertSessionHasErrors('collected_amount');

        $this->assertSame('0.00', $driver->fresh()->cash_balance);
    }

    public function test_settling_never_drives_the_cash_box_negative(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 5000]);

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 5000,
        ]);

        $this->actingAs($this->company)->post(route('distribution.drivers.settle', $driver->id), [
            'amount' => 999999,
        ]);

        $this->assertSame('0.00', $driver->fresh()->cash_balance);
    }


    private function warehouseWithStock(int $productId, float $quantity): int
    {
        $warehouseId = DB::table('warehouses')->insertGetId([
            'name' => 'Main',
            // name/address/city/zip_code are all NOT NULL on this table.
            'address' => 'Zone activite',
            'city' => 'Alger',
            'zip_code' => '16000',
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('warehouse_stocks')->insert([
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'quantity' => $quantity,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $warehouseId;
    }

    private function product(float $price = 100): int
    {
        return DB::table('product_service_items')->insertGetId([
            'name' => 'Vaccine',
            'sku' => 'VET-1',
            'sale_price' => $price,
            'purchase_price' => $price,
            'type' => 'product',
            'is_active' => 1,
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function customer(): int
    {
        return DB::table('customers')->insertGetId([
            'company_name' => 'Clinic',
            // All four are NOT NULL on this table.
            'customer_code' => 'CLT-'.uniqid(),
            'contact_person_name' => 'Dr. Test',
            'contact_person_email' => uniqid().'@clinic.test',
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_a_delivery_note_totals_its_own_lines(): void
    {
        $this->withoutExceptionHandling();
        $productId = $this->product(2100);

        $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
            'customer_id' => $this->customer(),
            'items' => [
                ['product_id' => $productId, 'quantity' => 4, 'unit_price' => 2100],
                ['product_id' => $productId, 'quantity' => 2, 'unit_price' => 1500],
            ],
        ])->assertSessionHasNoErrors();

        $note = DeliveryNote::latest('id')->first();

        $this->assertSame('11400.00', $note->total_amount);
        $this->assertCount(2, $note->items);
        $this->assertStringStartsWith('BL-', $note->reference);
    }

    public function test_stock_leaves_only_when_the_delivery_is_completed(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 38);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
            'customer_id' => $this->customer(),
            'warehouse_id' => $warehouseId,
            'driver_id' => $driver->user_id,
            'items' => [['product_id' => $productId, 'quantity' => 4, 'unit_price' => 100]],
        ]);

        $note = DeliveryNote::latest('id')->first();

        // Assigned but not delivered - the goods are still in the warehouse.
        $this->assertSame(38.0, (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity'));

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 400,
        ]);

        $this->assertSame(34.0, (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity'));
    }

    public function test_reopening_a_delivery_as_failed_returns_the_stock(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 38);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
            'customer_id' => $this->customer(),
            'warehouse_id' => $warehouseId,
            'driver_id' => $driver->user_id,
            'items' => [['product_id' => $productId, 'quantity' => 4, 'unit_price' => 100]],
        ]);

        $note = DeliveryNote::latest('id')->first();

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 400,
        ]);
        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_FAILED,
            'failure_reason' => 'Closed',
        ]);

        $this->assertSame(38.0, (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity'));
        $this->assertSame('0.00', $driver->fresh()->cash_balance);
    }

    public function test_every_cash_movement_is_written_to_the_ledger(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 5000]);

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 5000,
        ]);
        $this->actingAs($this->company)->post(route('distribution.drivers.settle', $driver->id), ['amount' => 2000]);

        $movements = DriverCashMovement::where('driver_id', $driver->id)->orderBy('id')->get();

        $this->assertCount(2, $movements);
        $this->assertSame('collection', $movements[0]->type);
        $this->assertSame('5000.00', $movements[0]->balance_after);
        $this->assertSame('settlement', $movements[1]->type);
        $this->assertSame('-2000.00', $movements[1]->amount);
        $this->assertSame('3000.00', $movements[1]->balance_after);
    }

    public function test_a_round_sequences_its_stops_and_assigns_its_driver(): void
    {
        $driver = $this->makeDriver();
        $first = $this->note();
        $second = $this->note();

        $this->actingAs($this->company)->post(route('distribution.rounds.store'), [
            'driver_id' => $driver->user_id,
            'round_date' => today()->toDateString(),
            'note_ids' => [$second->id, $first->id],
        ])->assertSessionHasNoErrors();

        $round = DeliveryRound::latest('id')->first();

        // The submitted order is the visiting order.
        $this->assertSame(1, $second->fresh()->sequence);
        $this->assertSame(2, $first->fresh()->sequence);
        $this->assertSame($round->id, $second->fresh()->round_id);
        $this->assertSame($driver->user_id, $second->fresh()->driver_id);
        $this->assertStringStartsWith('TRN-', $round->reference);
    }

    public function test_a_driver_carries_the_vehicle_assigned_in_fleet_tracking(): void
    {
        $withVan = $this->makeDriver();
        $withoutVan = $this->makeDriver();

        $vehicleId = DB::table('vehicles')->insertGetId([
            'name' => 'Camion 01',
            'plate_number' => '16-000-01',
            'vehicle_type' => 'van',
            'status' => 'active',
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('vehicle_assignments')->insert([
            'vehicle_id' => $vehicleId,
            'driver_id' => $withVan->user_id,
            'status' => 'active',
            'starts_at' => now(),
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $drivers = app(DistributionService::class)->drivers($this->company->id)->keyBy('id');

        // The planner fills the vehicle in from this, instead of asking twice.
        $this->assertSame($vehicleId, $drivers[$withVan->user_id]->vehicle_id);
        $this->assertSame('Camion 01', $drivers[$withVan->user_id]->vehicle_name);

        // And says so when there is nothing to fill in.
        $this->assertNull($drivers[$withoutVan->user_id]->vehicle_id);
    }

    public function test_references_are_generated_and_stay_sequential(): void
    {
        $driver = $this->makeDriver();
        $customer = $this->customer();

        foreach (range(1, 2) as $ignored) {
            $this->actingAs($this->company)->post(route('distribution.rounds.store'), [
                'driver_id' => $driver->user_id,
                'round_date' => today()->toDateString(),
                // The form no longer sends one; the service must fill it in.
                'reference' => '',
                'note_ids' => [],
            ]);

            $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
                'customer_id' => $customer,
                'reference' => '',
                'items' => [['description' => 'Item', 'quantity' => 1, 'unit_price' => 100]],
            ]);
        }

        $this->assertSame(
            ['TRN-'.now()->year.'-001', 'TRN-'.now()->year.'-002'],
            DeliveryRound::orderBy('id')->pluck('reference')->all()
        );

        // Both prefixes pad to three digits, so the two never look different.
        $this->assertSame(
            ['BL-'.now()->year.'-001', 'BL-'.now()->year.'-002'],
            DeliveryNote::orderBy('id')->pluck('reference')->all()
        );
    }

    public function test_a_round_cannot_be_saved_without_a_driver_and_a_date(): void
    {
        // A round with no driver cannot be driven, and one with no date cannot
        // be scheduled; both used to be nullable, so blank rounds could be saved.
        $this->actingAs($this->company)
            ->post(route('distribution.rounds.store'), ['note_ids' => []])
            ->assertSessionHasErrors(['driver_id', 'round_date']);

        $this->assertDatabaseCount('delivery_rounds', 0);
    }

    public function test_the_round_planner_shows_who_each_stop_is_for(): void
    {
        $note = $this->note(['customer_id' => $this->customer()]);
        $note->items()->create([
            'product_id' => null,
            'description' => 'Amoxicilline',
            'quantity' => 3,
            'delivered_quantity' => 0,
            'unit_price' => 500,
            'creator_id' => $this->company->id,
            'created_by' => $this->company->id,
        ]);

        $this->actingAs($this->company)
            ->get(route('distribution.rounds'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('assignable_notes', 1, fn (AssertableInertia $item) => $item
                    // A bare reference gives a planner nothing to sequence by.
                    ->where('customer_name', 'Clinic')
                    ->where('items_count', 1)
                    ->where('items_summary', '3× Amoxicilline')
                    ->etc())
                ->etc());
    }

    public function test_cancelling_a_round_releases_its_stops(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note();

        $this->actingAs($this->company)->post(route('distribution.rounds.store'), [
            'driver_id' => $driver->user_id,
            'round_date' => today()->toDateString(),
            'note_ids' => [$note->id],
        ]);
        $round = DeliveryRound::latest('id')->first();

        $this->actingAs($this->company)->put(route('distribution.rounds.transition', $round->id), [
            'action' => 'cancel',
        ]);

        $this->assertNull($note->fresh()->round_id);
        $this->assertSame(0, $note->fresh()->sequence);
    }

    public function test_starting_a_round_stamps_the_time_the_metric_measures_from(): void
    {
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.rounds.store'), [
            'driver_id' => $driver->user_id,
            'round_date' => today()->toDateString(),
            'note_ids' => [],
        ]);
        $round = DeliveryRound::latest('id')->first();

        $this->assertNull($round->started_at);

        $this->actingAs($this->company)->put(route('distribution.rounds.transition', $round->id), [
            'action' => 'start',
        ]);

        $this->assertNotNull($round->fresh()->started_at);
        $this->assertSame(DeliveryRound::STATUS_IN_PROGRESS, $round->fresh()->status);
    }


    public function test_the_office_can_log_in_as_one_of_its_drivers(): void
    {
        $driver = $this->makeDriver();

        $this->actingAs($this->company)
            ->post(route('distribution.drivers.impersonate', $driver->id))
            ->assertRedirect(route('distribution.driver.home'));

        $this->assertAuthenticatedAs($driver->user);
        // The session marker is what the header's "leave" control acts on.
        $this->assertSame($this->company->id, session('impersonator_id'));
    }

    public function test_leaving_returns_the_office_user(): void
    {
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.drivers.impersonate', $driver->id));
        $this->post(route('users.leave-impersonation'));

        $this->assertAuthenticatedAs($this->company);
        $this->assertNull(session('impersonator_id'));
    }

    public function test_another_company_cannot_log_in_as_this_driver(): void
    {
        $driver = $this->makeDriver();
        $stranger = $this->otherCompany('impersonation-stranger@example.test');
        $this->givePermissions($stranger, self::PERMISSIONS);

        $this->actingAs($stranger)
            ->post(route('distribution.drivers.impersonate', $driver->id))
            ->assertRedirect(route('distribution.drivers'));

        // Still the stranger - no cross-tenant step-in.
        $this->assertAuthenticatedAs($stranger);
    }

    public function test_an_inactive_driver_cannot_be_impersonated(): void
    {
        $driver = $this->makeDriver();
        $driver->update(['status' => Driver::STATUS_INACTIVE]);

        $this->actingAs($this->company)
            ->from(route('distribution.drivers'))
            ->post(route('distribution.drivers.impersonate', $driver->id))
            ->assertRedirect(route('distribution.drivers'));

        $this->assertAuthenticatedAs($this->company);
    }

    public function test_impersonating_twice_keeps_the_original_office_user(): void
    {
        $first = $this->makeDriver();
        $second = $this->makeDriver(['phone' => '0555303030']);

        $this->actingAs($this->company)->post(route('distribution.drivers.impersonate', $first->id));
        $this->post(route('distribution.drivers.impersonate', $second->id));

        // Stepping sideways must not overwrite who started the impersonation,
        // or leaving would strand the session on a driver account.
        $this->assertSame($this->company->id, session('impersonator_id'));
    }


    public function test_loading_a_van_moves_stock_without_creating_any(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 42);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.drivers.load', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 10]],
        ])->assertSessionHasNoErrors();

        $warehouse = (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity');
        $van = (float) DriverStock::where('driver_id', $driver->id)->where('product_id', $productId)->value('quantity');

        $this->assertSame(32.0, $warehouse);
        $this->assertSame(10.0, $van);
        // The point of the whole operation: stock relocates, never appears.
        $this->assertSame(42.0, $warehouse + $van);
    }

    public function test_loading_more_than_the_warehouse_has_takes_only_what_is_there(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 30);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.drivers.load', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 9999]],
        ]);

        $warehouse = (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity');
        $van = (float) DriverStock::where('driver_id', $driver->id)->where('product_id', $productId)->value('quantity');

        $this->assertSame(0.0, $warehouse);
        $this->assertSame(30.0, $van);
    }

    public function test_a_driver_cannot_hand_back_more_than_they_carry(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 20);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.drivers.load', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 5]],
        ]);
        $this->actingAs($this->company)->post(route('distribution.drivers.unload', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 999]],
        ]);

        $van = (float) DriverStock::where('driver_id', $driver->id)->where('product_id', $productId)->value('quantity');
        $warehouse = (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity');

        $this->assertSame(0.0, $van);
        $this->assertSame(20.0, $warehouse);
    }

    public function test_every_van_movement_is_recorded(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 20);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.drivers.load', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 8]],
        ]);
        $this->actingAs($this->company)->post(route('distribution.drivers.unload', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 3]],
        ]);

        $movements = DriverStockMovement::where('driver_id', $driver->id)->orderBy('id')->get();

        $this->assertCount(2, $movements);
        $this->assertSame('load', $movements[0]->type);
        $this->assertSame('8.00', $movements[0]->quantity_after);
        $this->assertSame('unload', $movements[1]->type);
        $this->assertSame('-3.00', $movements[1]->quantity);
        $this->assertSame('5.00', $movements[1]->quantity_after);
    }

    public function test_a_driver_can_hand_their_own_cash_in(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 4500]);

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 4500,
        ]);

        $this->actingAs($driver->user)
            ->post(route('distribution.driver.deposit'), ['amount' => 1500])
            ->assertSessionHasNoErrors();

        $this->assertSame('3000.00', $driver->fresh()->cash_balance);
    }

    public function test_a_driver_cannot_hand_in_more_than_they_hold(): void
    {
        $driver = $this->makeDriver();

        $this->actingAs($driver->user)
            ->from(route('distribution.driver.home'))
            ->post(route('distribution.driver.deposit'), ['amount' => 999])
            ->assertSessionHasErrors('amount');

        $this->assertSame('0.00', $driver->fresh()->cash_balance);
    }


    public function test_pinning_a_customer_puts_it_on_the_map(): void
    {
        $customerId = $this->customer();

        $this->actingAs($this->company)->post(route('distribution.map.pin'), [
            'type' => 'customer',
            'id' => $customerId,
            'latitude' => 36.75,
            'longitude' => 3.05,
        ])->assertSessionHasNoErrors();

        $this->assertSame(36.75, (float) DB::table('customers')->where('id', $customerId)->value('latitude'));
        $this->assertCount(1, app(DistributionService::class)->mapData($this->company->id)['customers']);
    }

    public function test_a_pin_cannot_move_another_companys_record(): void
    {
        $customerId = $this->customer();
        $stranger = $this->otherCompany('pin-stranger@example.test');
        $this->givePermissions($stranger, self::PERMISSIONS);

        $this->actingAs($stranger)->post(route('distribution.map.pin'), [
            'type' => 'customer',
            'id' => $customerId,
            'latitude' => 1.0,
            'longitude' => 1.0,
        ]);

        $this->assertNull(DB::table('customers')->where('id', $customerId)->value('latitude'));
    }

    public function test_the_head_office_pin_is_stored_and_read_back(): void
    {
        $this->actingAs($this->company)->post(route('distribution.map.pin'), [
            'type' => 'headquarters',
            'latitude' => 36.7538,
            'longitude' => 3.0588,
        ]);

        $headquarters = app(DistributionService::class)->mapData($this->company->id)['headquarters'];

        $this->assertNotNull($headquarters);
        $this->assertSame(36.7538, $headquarters['latitude']);
    }

    public function test_out_of_range_coordinates_are_rejected(): void
    {
        $this->actingAs($this->company)
            ->from(route('distribution.map'))
            ->post(route('distribution.map.pin'), [
                'type' => 'headquarters',
                'latitude' => 999,
                'longitude' => 3.0,
            ])
            ->assertSessionHasErrors('latitude');
    }

    public function test_a_signature_is_stored_as_proof_of_delivery(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 1000]);

        // A 1x1 PNG is enough to prove the path is written.
        $png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 1000,
            'recipient_name' => 'Dr. Samira',
            'signature_data' => $png,
        ])->assertSessionHasNoErrors();

        $this->assertNotNull($note->fresh()->signature_path);
    }

    public function test_completing_without_a_signature_still_works(): void
    {
        $driver = $this->makeDriver();
        $note = $this->note(['driver_id' => $driver->user_id, 'total_amount' => 1000]);

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 1000,
        ])->assertSessionHasNoErrors();

        $this->assertSame(DeliveryNote::STATUS_DELIVERED, $note->fresh()->status);
        $this->assertNull($note->fresh()->signature_path);
    }


    public function test_a_new_driver_can_track_their_own_location(): void
    {
        $driver = $this->makeDriver();

        // Fleet tracking refuses to start a session without this, so a driver
        // created here would be permanently invisible on the map.
        $this->assertTrue($driver->user->can('track-own-location'));
    }

    public function test_assigning_a_fleet_vehicle_creates_the_active_assignment(): void
    {
        $driver = $this->makeDriver();
        $vehicleId = DB::table('vehicles')->insertGetId([
            'name' => 'Van',
            'plate_number' => '16-000-01',
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->company)->put(route('distribution.drivers.update', $driver->id), [
            'name' => $driver->name,
            'phone' => $driver->phone,
            'vehicle_id' => $vehicleId,
            'max_discount_type' => 'percent',
            'max_discount_value' => 0,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('vehicle_assignments', [
            'driver_id' => $driver->user_id,
            'vehicle_id' => $vehicleId,
            'status' => 'active',
        ]);
    }

    public function test_a_driver_is_only_ever_on_one_vehicle(): void
    {
        $driver = $this->makeDriver();

        $vehicles = collect(['A', 'B'])->map(fn ($name) => DB::table('vehicles')->insertGetId([
            'name' => $name,
            'plate_number' => '16-000-'.$name,
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]));

        foreach ($vehicles as $vehicleId) {
            $this->actingAs($this->company)->put(route('distribution.drivers.update', $driver->id), [
                'name' => $driver->name,
                'phone' => $driver->phone,
                'vehicle_id' => $vehicleId,
                'max_discount_type' => 'percent',
                'max_discount_value' => 0,
            ]);
        }

        // Reassigning closes the previous one rather than stacking.
        $this->assertSame(1, DB::table('vehicle_assignments')
            ->where('driver_id', $driver->user_id)->where('status', 'active')->count());
        $this->assertDatabaseHas('vehicle_assignments', [
            'driver_id' => $driver->user_id,
            'vehicle_id' => $vehicles->last(),
            'status' => 'active',
        ]);
    }


    public function test_the_driver_map_shows_only_that_drivers_stops(): void
    {
        $mine = $this->makeDriver();
        $theirs = $this->makeDriver(['phone' => '0555606060']);

        $this->note(['driver_id' => $mine->user_id, 'latitude' => 36.75, 'longitude' => 3.05]);
        $this->note(['driver_id' => $theirs->user_id, 'latitude' => 35.69, 'longitude' => -0.63]);

        $data = app(DriverPortalService::class)->mapData($mine);

        $this->assertCount(1, $data['stops']);
        $this->assertSame(36.75, $data['stops'][0]['latitude']);
    }

    public function test_the_driver_map_reports_no_position_until_the_vehicle_has_a_fix(): void
    {
        $driver = $this->makeDriver();

        $this->assertNull(app(DriverPortalService::class)->mapData($driver)['me']);

        $vehicleId = DB::table('vehicles')->insertGetId([
            'name' => 'Van',
            'plate_number' => '16-000-09',
            'last_latitude' => 36.762,
            'last_longitude' => 3.051,
            'created_by' => $this->company->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        app(DriverService::class)->assignVehicle($driver, $vehicleId);

        $me = app(DriverPortalService::class)->mapData($driver)['me'];

        $this->assertNotNull($me);
        $this->assertSame(36.762, $me['latitude']);
    }

    public function test_a_stop_without_coordinates_is_left_off_the_map(): void
    {
        $driver = $this->makeDriver();

        $this->note(['driver_id' => $driver->user_id, 'latitude' => 36.75, 'longitude' => 3.05]);
        // Unpinned customer, so the note has nowhere to be drawn.
        $this->note(['driver_id' => $driver->user_id]);

        $this->assertCount(1, app(DriverPortalService::class)->mapData($driver)['stops']);
    }


    public function test_a_completed_stop_carries_everything_the_receipt_prints(): void
    {
        $productId = $this->product(1850);
        $driver = $this->makeDriver();
        $customerId = $this->customer();

        $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
            'customer_id' => $customerId,
            'driver_id' => $driver->user_id,
            'items' => [
                ['product_id' => $productId, 'description' => 'Amoxicilline', 'quantity' => 2, 'unit_price' => 1850],
                ['product_id' => $productId, 'description' => 'Ketoprofen', 'quantity' => 1, 'unit_price' => 2500],
            ],
        ]);

        $note = DeliveryNote::latest('id')->first();

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 6200,
            'recipient_name' => 'Dr. Samira',
        ]);

        $this->actingAs($driver->user)
            ->get(route('distribution.driver.round'))
            ->assertInertia(function ($page) {
                $printed = collect($page->toArray()['props']['notes'])->firstWhere('status', 'delivered');

                // Every field the receipt renders must reach the page, or it
                // prints a blank line where a product should be.
                $this->assertNotNull($printed['customer_name']);
                $this->assertCount(2, $printed['items']);
                // JSON gives back an int for a whole number; the value is what matters.
                $this->assertEquals(6200, $printed['total_amount']);
                $this->assertSame('Dr. Samira', $printed['recipient_name']);
            });
    }


    public function test_delivering_from_the_van_does_not_charge_the_warehouse_twice(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 100);
        $driver = $this->makeDriver();

        // 10 leave the warehouse and go onto the van.
        $this->actingAs($this->company)->post(route('distribution.drivers.load', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 10]],
        ]);

        $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
            'customer_id' => $this->customer(),
            'warehouse_id' => $warehouseId,
            'driver_id' => $driver->user_id,
            'items' => [['product_id' => $productId, 'quantity' => 4, 'unit_price' => 100]],
        ]);
        $note = DeliveryNote::latest('id')->first();

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 400,
        ]);

        $warehouse = (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity');
        $van = (float) DriverStock::where('driver_id', $driver->id)->where('product_id', $productId)->value('quantity');

        // The 4 leave the van, not the warehouse a second time.
        $this->assertSame(90.0, $warehouse);
        $this->assertSame(6.0, $van);
        // 90 in store + 6 on the van + 4 delivered = the 100 we started with.
        $this->assertSame(96.0, $warehouse + $van);
    }

    public function test_a_delivery_beyond_the_van_falls_back_to_the_warehouse(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 100);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.drivers.load', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 3]],
        ]);

        $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
            'customer_id' => $this->customer(),
            'warehouse_id' => $warehouseId,
            'driver_id' => $driver->user_id,
            'items' => [['product_id' => $productId, 'quantity' => 5, 'unit_price' => 100]],
        ]);
        $note = DeliveryNote::latest('id')->first();

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 500,
        ]);

        // Van covers 3, the remaining 2 come out of the warehouse (97 - 2).
        $this->assertSame(0.0, (float) DriverStock::where('driver_id', $driver->id)
            ->where('product_id', $productId)->value('quantity'));
        $this->assertSame(95.0, (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity'));
    }

    public function test_reversing_a_van_delivery_puts_the_goods_back_on_the_van(): void
    {
        $productId = $this->product();
        $warehouseId = $this->warehouseWithStock($productId, 100);
        $driver = $this->makeDriver();

        $this->actingAs($this->company)->post(route('distribution.drivers.load', $driver->id), [
            'warehouse_id' => $warehouseId,
            'items' => [['product_id' => $productId, 'quantity' => 10]],
        ]);

        $this->actingAs($this->company)->post(route('distribution.delivery-notes.store'), [
            'customer_id' => $this->customer(),
            'warehouse_id' => $warehouseId,
            'driver_id' => $driver->user_id,
            'items' => [['product_id' => $productId, 'quantity' => 4, 'unit_price' => 100]],
        ]);
        $note = DeliveryNote::latest('id')->first();

        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_DELIVERED,
            'collected_amount' => 400,
        ]);
        $this->actingAs($driver->user)->put(route('distribution.driver.notes.complete', $note->id), [
            'status' => DeliveryNote::STATUS_FAILED,
            'failure_reason' => 'Closed',
        ]);

        // Back exactly where it came from: the van, not the warehouse.
        $this->assertSame(10.0, (float) DriverStock::where('driver_id', $driver->id)
            ->where('product_id', $productId)->value('quantity'));
        $this->assertSame(90.0, (float) DB::table('warehouse_stocks')
            ->where('warehouse_id', $warehouseId)->where('product_id', $productId)->value('quantity'));
    }

    public function test_a_company_without_the_permissions_is_turned_away(): void
    {
        $stranger = $this->otherCompany('distribution-stranger@example.test');

        $this->actingAs($stranger)
            ->get(route('distribution.index'))
            ->assertRedirect(route('dashboard'));
    }
}
