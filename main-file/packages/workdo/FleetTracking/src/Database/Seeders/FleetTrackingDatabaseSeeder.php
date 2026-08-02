<?php

namespace Workdo\FleetTracking\Database\Seeders;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;

class FleetTrackingDatabaseSeeder extends Seeder
{
    public function run()
    {
        Model::unguard();

        $this->call(PermissionTableSeeder::class);
    }
}
