<?php

namespace Workdo\Zakat\Database\Seeders;

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
            ['name' => 'manage-zakat', 'module' => 'zakat', 'label' => 'Manage Zakat'],
            ['name' => 'view-zakat', 'module' => 'zakat', 'label' => 'View Zakat'],
            ['name' => 'create-zakat-calculations', 'module' => 'zakat', 'label' => 'Create Zakat Calculations'],
            ['name' => 'finalize-zakat-calculations', 'module' => 'zakat', 'label' => 'Finalize Zakat Calculations'],
            ['name' => 'record-zakat-payments', 'module' => 'zakat', 'label' => 'Record Zakat Payments'],
            ['name' => 'print-zakat-reports', 'module' => 'zakat', 'label' => 'Print Zakat Reports'],
            ['name' => 'manage-zakat-settings', 'module' => 'zakat', 'label' => 'Manage Zakat Settings'],
        ];

        $companyRole = Role::where('name', 'company')->first();

        foreach ($permissions as $permission) {
            $permissionObj = Permission::firstOrCreate(
                ['name' => $permission['name'], 'guard_name' => 'web'],
                [
                    'module' => $permission['module'],
                    'label' => $permission['label'],
                    'add_on' => 'Zakat',
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
