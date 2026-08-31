<?php

namespace Database\Seeders;

use App\Models\AddOn;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * Grants the demo company access to the modules it ships with.
 *
 * A module is only reachable when four separate things line up, and every one
 * of them lives in the database rather than in code:
 *
 *   1. an `add_ons` row, enabled                (ModuleCatalogSeeder)
 *   2. the module named in the plan's `modules` (PlanSeeder)
 *   3. `users.active_plan` pointing at that plan
 *   4. a `user_active_modules` row per module
 *
 * Miss any one and PlanModuleCheck answers 403 while the package looks
 * perfectly installed on disk. Rebuilding this by hand is slow and easy to get
 * wrong, so it is seeded instead of remembered.
 */
class CompanyModuleAccessSeeder extends Seeder
{
    /** Package seeders that register their own Spatie permissions. */
    private const PACKAGE_PERMISSION_SEEDERS = [
        \Workdo\Distribution\Database\Seeders\PermissionTableSeeder::class,
        \Workdo\FleetTracking\Database\Seeders\PermissionTableSeeder::class,
        \Workdo\Zakat\Database\Seeders\PermissionTableSeeder::class,
    ];

    public function run(?int $userId = null): void
    {
        $company = $userId
            ? User::find($userId)
            : User::where('email', 'company@example.com')->first();

        if (!$company) {
            return;
        }

        // The richest plan, so the demo company can reach everything it has.
        $plan = DB::table('plans')->orderByDesc('id')->first();

        if ($plan && $company->active_plan != $plan->id) {
            $company->active_plan = $plan->id;
            $company->save();
        }

        $modules = $plan ? (json_decode($plan->modules ?? '[]', true) ?: []) : [];

        // Only modules that actually exist in the catalog: a user_active_modules
        // row for a package that was never installed is dead weight.
        $installed = AddOn::whereIn('module', $modules)->pluck('module')->all();

        foreach ($installed as $module) {
            DB::table('user_active_modules')->updateOrInsert(
                ['user_id' => $company->id, 'module' => $module],
                ['updated_at' => now(), 'created_at' => now()]
            );
        }

        foreach (self::PACKAGE_PERMISSION_SEEDERS as $seeder) {
            if (class_exists($seeder)) {
                (new $seeder())->run();
            }
        }

        // Spatie caches the permission map; without this the fresh grants are
        // invisible until the next process starts.
        Artisan::call('cache:clear');
    }
}
