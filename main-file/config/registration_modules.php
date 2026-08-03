<?php

/*
|--------------------------------------------------------------------------
| Registration module picker
|--------------------------------------------------------------------------
|
| The cards shown on the company registration page. Each card activates one
| or more real packages from packages/workdo (see database/seeders/
| ModuleCatalogSeeder.php, which seeds the matching `add_ons` rows).
|
| - `base`     the card is always selected and cannot be turned off.
| - `group`    cards sharing a group are mutually exclusive, so the two
|              Distribution tiers behave like radio options.
| - `modules`  package names activated in `user_active_modules` on signup.
| - `driver_limit`  how many livreur accounts the tier allows; null = no cap.
|
| Prices are DZD. Changing them here changes what the picker charges; the
| per-module prices in `add_ons` are what the rest of the app bills against.
|
*/

return [

    'currency' => 'DA',

    'trial_days' => 7,

    'cards' => [

        [
            'key' => 'commercial',
            'name' => 'Commercial (PRO)',
            'description' => 'POS, Ventes, Stock, Clients',
            'icon' => 'shopping-cart',
            'base' => true,
            'group' => null,
            'monthly_price' => 1000,
            'yearly_price' => 11000,
            'free_months' => 1,
            'modules' => ['Pos', 'ProductService', 'Account'],
            'driver_limit' => null,
        ],

        [
            'key' => 'distribution_5',
            'name' => 'Distribution (5 livreurs)',
            'description' => 'Livreurs, tournées, GPS',
            'icon' => 'truck',
            'base' => false,
            'group' => 'distribution',
            'monthly_price' => 1500,
            'yearly_price' => 25000,
            'free_months' => 2,
            'modules' => ['FleetTracking'],
            'driver_limit' => 5,
        ],

        [
            'key' => 'distribution_unlimited',
            'name' => 'Distribution (illimité)',
            'description' => 'Livreurs, tournées, GPS - Sans limite',
            'icon' => 'users',
            'base' => false,
            'group' => 'distribution',
            'monthly_price' => 5500,
            'yearly_price' => 65000,
            'free_months' => 2,
            'modules' => ['FleetTracking'],
            'driver_limit' => null,
        ],

        [
            'key' => 'zakat',
            'name' => 'Zakat',
            'description' => 'Nisab, haul, calculs et rapports',
            'icon' => 'calculator',
            'base' => false,
            'group' => null,
            'monthly_price' => 500,
            'yearly_price' => 5000,
            'free_months' => 2,
            'modules' => ['Zakat'],
            'driver_limit' => null,
        ],

        [
            'key' => 'hrm',
            'name' => 'Ressources Humaines',
            'description' => 'Employés, pointage, paie, contrats',
            'icon' => 'user-cog',
            'base' => false,
            'group' => null,
            'monthly_price' => 500,
            'yearly_price' => 5000,
            'free_months' => 2,
            'modules' => ['Hrm'],
            'driver_limit' => null,
        ],

        [
            'key' => 'crm',
            'name' => 'CRM / Projets',
            'description' => 'Prospects, deals, projets, planning',
            'icon' => 'briefcase',
            'base' => false,
            'group' => null,
            'monthly_price' => 1000,
            'yearly_price' => 12000,
            'free_months' => 0,
            'modules' => ['Lead', 'Taskly'],
            'driver_limit' => null,
        ],

        [
            'key' => 'support',
            'name' => 'Support / Helpdesk',
            'description' => 'Tickets, base de connaissances',
            'icon' => 'headphones',
            'base' => false,
            'group' => null,
            'monthly_price' => 600,
            'yearly_price' => 6000,
            'free_months' => 2,
            'modules' => ['SupportTicket'],
            'driver_limit' => null,
        ],

    ],

];
