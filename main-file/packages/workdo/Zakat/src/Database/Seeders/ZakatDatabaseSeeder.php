<?php

namespace Workdo\Zakat\Database\Seeders;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;

class ZakatDatabaseSeeder extends Seeder
{
    public function run()
    {
        Model::unguard();

        $this->call(PermissionTableSeeder::class);
    }
}
