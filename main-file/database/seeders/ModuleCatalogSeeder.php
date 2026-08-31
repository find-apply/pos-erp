<?php

namespace Database\Seeders;

use App\Models\AddOn;
use Illuminate\Database\Seeder;

/**
 * Seeds `add_ons` - the module catalog the whole app reads through
 * App\Classes\Module. One row per real package under packages/workdo, with
 * `module` and `package_name` matching that package's module.json.
 *
 * Prices are in DZD. A module that ships inside a bundle carries 0 and is
 * billed through the bundle's primary module - see config/registration_modules.php
 * for how these rows are grouped into the cards shown at registration.
 */
class ModuleCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            // Commercial (PRO) bundle - billed on Pos.
            ['module' => 'Pos', 'name' => 'POS', 'package_name' => 'pos', 'monthly_price' => 1000, 'yearly_price' => 11000, 'priority' => 50],
            ['module' => 'ProductService', 'name' => 'Product & Service', 'package_name' => 'product-service', 'monthly_price' => 0, 'yearly_price' => 0, 'priority' => 0],
            ['module' => 'Account', 'name' => 'Accounting', 'package_name' => 'account', 'monthly_price' => 0, 'yearly_price' => 0, 'priority' => 20],

            // Distribution - price depends on the tier chosen at registration.
            ['module' => 'Distribution', 'name' => 'Distribution', 'package_name' => 'distribution', 'monthly_price' => 0, 'yearly_price' => 0, 'priority' => 400],
            ['module' => 'FleetTracking', 'name' => 'Fleet Tracking', 'package_name' => 'fleet-tracking', 'monthly_price' => 1500, 'yearly_price' => 25000, 'priority' => 240],

            ['module' => 'Zakat', 'name' => 'Zakat', 'package_name' => 'zakat', 'monthly_price' => 500, 'yearly_price' => 5000, 'priority' => 230],
            ['module' => 'Hrm', 'name' => 'HRM', 'package_name' => 'hrm', 'monthly_price' => 500, 'yearly_price' => 5000, 'priority' => 30],

            // CRM / Projets bundle - billed on Lead.
            ['module' => 'Lead', 'name' => 'CRM', 'package_name' => 'lead', 'monthly_price' => 1000, 'yearly_price' => 12000, 'priority' => 40],
            ['module' => 'Taskly', 'name' => 'Project', 'package_name' => 'taskly', 'monthly_price' => 0, 'yearly_price' => 0, 'priority' => 10],

            ['module' => 'SupportTicket', 'name' => 'Support Ticket', 'package_name' => 'support-ticket', 'monthly_price' => 600, 'yearly_price' => 6000, 'priority' => 130],
        ];

        foreach ($modules as $module) {
            AddOn::updateOrCreate(
                ['module' => $module['module']],
                $module + ['is_enable' => 1, 'for_admin' => 0]
            );
        }
    }
}
