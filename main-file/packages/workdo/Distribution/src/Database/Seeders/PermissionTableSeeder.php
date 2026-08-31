<?php

namespace Workdo\Distribution\Database\Seeders;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionTableSeeder extends Seeder
{
    public function run(): void
    {
        Model::unguard();
        Artisan::call('cache:clear');

        $permissions = [
            ['name' => 'manage-distribution', 'label' => 'Manage Distribution'],
            ['name' => 'view-distribution', 'label' => 'View Distribution'],
            ['name' => 'manage-distribution-drivers', 'label' => 'Manage Distribution Drivers'],
            ['name' => 'manage-delivery-notes', 'label' => 'Manage Delivery Notes'],
            ['name' => 'manage-delivery-rounds', 'label' => 'Manage Delivery Rounds'],
            ['name' => 'view-distribution-map', 'label' => 'View Distribution Map'],
            ['name' => 'view-distribution-performance', 'label' => 'View Distribution Performance'],
        ];

        $companyRole = Role::where('name', 'company')->first();

        foreach ($permissions as $permission) {
            $permissionObj = Permission::firstOrCreate(
                ['name' => $permission['name'], 'guard_name' => 'web'],
                [
                    'module' => 'distribution',
                    'label' => $permission['label'],
                    'add_on' => 'Distribution',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            if ($companyRole && !$companyRole->hasPermissionTo($permissionObj)) {
                $companyRole->givePermissionTo($permissionObj);
            }
        }
    }
}
