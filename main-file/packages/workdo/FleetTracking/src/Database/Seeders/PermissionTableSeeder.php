<?php

namespace Workdo\FleetTracking\Database\Seeders;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionTableSeeder extends Seeder
{
    public function run()
    {
        Model::unguard();
        Artisan::call('cache:clear');

        $permissions = [
            ['name' => 'manage-fleet-tracking', 'module' => 'fleet-tracking', 'label' => 'Manage Fleet Tracking'],
            ['name' => 'view-fleet-map', 'module' => 'fleet-tracking', 'label' => 'View Fleet Map'],
            ['name' => 'track-own-location', 'module' => 'fleet-tracking', 'label' => 'Track Own Location'],
            ['name' => 'manage-vehicles', 'module' => 'fleet-tracking', 'label' => 'Manage Vehicles'],
        ];

        $companyRole = Role::where('name', 'company')->first();
        $staffRoles = Role::where('name', 'staff')->get();

        foreach ($permissions as $permission) {
            $permissionObj = Permission::firstOrCreate(
                ['name' => $permission['name'], 'guard_name' => 'web'],
                [
                    'module' => $permission['module'],
                    'label' => $permission['label'],
                    'add_on' => 'FleetTracking',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            if ($companyRole && !$companyRole->hasPermissionTo($permissionObj)) {
                $companyRole->givePermissionTo($permissionObj);
            }

            if ($permission['name'] === 'track-own-location') {
                foreach ($staffRoles as $staffRole) {
                    if (!$staffRole->hasPermissionTo($permissionObj)) {
                        $staffRole->givePermissionTo($permissionObj);
                    }
                }
            }
        }
    }
}
