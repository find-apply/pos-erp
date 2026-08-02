<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PizzaAlgeriaSeeder extends Seeder
{
    private int $companyId;

    public function run(): void
    {
        $company = User::where('email', 'company@example.com')->first()
            ?? User::where('type', 'company')->orderBy('id')->first();

        if (! $company) {
            $this->command?->error('No company user found.');
            return;
        }

        $company->update([
            'name' => 'DzPizza Algerie',
            'lang' => 'ar',
        ]);

        $this->companyId = (int) $company->id;

        DB::transaction(function () {
            $this->seedSettings();
            $this->seedPartners();
            $this->seedWarehouses();
            $this->seedCatalog();
        });

        $this->command?->info('Pizza Algeria seed data created for company ID '.$this->companyId.'.');
    }

    private function seedSettings(): void
    {
        $now = now();
        $settings = [
            'defaultLanguage' => 'ar',
            'layoutDirection' => 'rtl',
            'defaultCurrency' => 'DZD',
            'currencySymbol' => 'د.ج',
            'currencySymbolPosition' => 'before',
            'currencySymbolSpace' => '0',
        ];

        foreach ($settings as $key => $value) {
            DB::table('settings')->updateOrInsert(
                ['key' => $key, 'created_by' => $this->companyId],
                ['value' => $value, 'is_public' => 1, 'updated_at' => $now, 'created_at' => $now]
            );
        }
    }

    private function seedPartners(): void
    {
        $now = now();

        $customers = [
            ['PIZ-CUST-001', 'Client Comptoir DzPizza', 'Caisse principale', 'comptoir@dzpizza.dz', '0550000001', 'Alger Centre', '16000', 'Client walk-in pour ventes POS'],
            ['PIZ-CUST-002', 'Bureau Casbah Services', 'Nadia Bensalem', 'contact@casbah-services.dz', '0551234567', 'Alger', '16000', 'Commandes de groupe pour bureaux'],
            ['PIZ-CUST-003', 'Residence Etudiants Bab Ezzouar', 'Karim Haddad', 'resto@residence-babez.dz', '0562345678', 'Bab Ezzouar', '16024', 'Commandes evenementielles et offres etudiants'],
            ['PIZ-CUST-004', 'Salle Evenementielle El Bahia', 'Samira Touati', 'events@elbahia.dz', '0773456789', 'Oran', '31000', 'Plateaux pizza pour anniversaires et reunions'],
        ];

        foreach ($customers as [$code, $company, $person, $email, $mobile, $city, $zip, $notes]) {
            $address = $this->address($person, $city, $zip);
            DB::table('customers')->updateOrInsert(
                ['customer_code' => $code, 'created_by' => $this->companyId],
                [
                    'user_id' => null,
                    'company_name' => $company,
                    'contact_person_name' => $person,
                    'contact_person_email' => $email,
                    'contact_person_mobile' => $mobile,
                    'tax_number' => null,
                    'payment_terms' => 'Comptant',
                    'billing_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                    'shipping_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                    'same_as_billing' => 1,
                    'notes' => $notes,
                    'creator_id' => $this->companyId,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }

        $vendors = [
            ['PIZ-VEN-001', 'Sarl Semoulerie Mitidja', 'Yacine Hamidi', 'vente@semoulerie-mitidja.dz', '0554567890', 'Blida', '09000', 'Farine et semoule pour pate pizza'],
            ['PIZ-VEN-002', 'Laiterie FromaDz', 'Lina Belkacem', 'commercial@fromadz.dz', '0565678901', 'Tizi Ouzou', '15000', 'Mozzarella, fromage fondu et creme'],
            ['PIZ-VEN-003', 'Tomates Sud Distribution', 'Amine Kaci', 'orders@tomates-sud.dz', '0776789012', 'Biskra', '07000', 'Sauce tomate, concentre et epices'],
            ['PIZ-VEN-004', 'Boissons Atlas', 'Mourad Saidi', 'contact@boissons-atlas.dz', '0557890123', 'Alger', '16000', 'Boissons et emballages livraison'],
        ];

        foreach ($vendors as [$code, $company, $person, $email, $mobile, $city, $zip, $notes]) {
            $address = $this->address($person, $city, $zip);
            DB::table('vendors')->updateOrInsert(
                ['vendor_code' => $code, 'created_by' => $this->companyId],
                [
                    'user_id' => null,
                    'company_name' => $company,
                    'contact_person_name' => $person,
                    'contact_person_email' => $email,
                    'contact_person_mobile' => $mobile,
                    'tax_number' => 'NIF '.substr(str_pad((string) crc32($code), 15, '0', STR_PAD_LEFT), 0, 15),
                    'payment_terms' => '30 jours',
                    'billing_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                    'shipping_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                    'same_as_billing' => 1,
                    'notes' => $notes,
                    'creator_id' => $this->companyId,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }
    }

    private function seedWarehouses(): void
    {
        $now = now();
        $warehouses = [
            ['Cuisine Centrale DzPizza Alger', 'Rue Didouche Mourad', 'Alger', '16000', '0550101010', 'cuisine.alger@dzpizza.dz'],
            ['Depot Ingredients Blida', 'Zone industrielle Ouled Yaich', 'Blida', '09000', '0550202020', 'depot.blida@dzpizza.dz'],
            ['Point Vente Oran Akid Lotfi', 'Akid Lotfi Bir El Djir', 'Oran', '31000', '0550303030', 'oran@dzpizza.dz'],
        ];

        foreach ($warehouses as [$name, $address, $city, $zip, $phone, $email]) {
            DB::table('warehouses')->updateOrInsert(
                ['name' => $name, 'created_by' => $this->companyId],
                [
                    'address' => $address,
                    'city' => $city,
                    'zip_code' => $zip,
                    'phone' => $phone,
                    'email' => $email,
                    'is_active' => 1,
                    'creator_id' => $this->companyId,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }
    }

    private function seedCatalog(): void
    {
        $now = now();

        $categories = [
            ['Pizzas classiques', '#ef4444'],
            ['Pizzas signature', '#f97316'],
            ['Ingredients pizza', '#22c55e'],
            ['Boissons', '#2563eb'],
            ['Desserts', '#a855f7'],
            ['Services livraison', '#64748b'],
        ];

        foreach ($categories as [$name, $color]) {
            DB::table('product_service_categories')->updateOrInsert(
                ['name' => $name, 'created_by' => $this->companyId],
                ['color' => $color, 'creator_id' => $this->companyId, 'updated_at' => $now, 'created_at' => $now]
            );
        }

        foreach (['Piece', 'Taille M', 'Taille L', 'Kg', 'Litre', 'Boite', 'Service'] as $unit) {
            DB::table('product_service_units')->updateOrInsert(
                ['unit_name' => $unit, 'created_by' => $this->companyId],
                ['creator_id' => $this->companyId, 'updated_at' => $now, 'created_at' => $now]
            );
        }

        foreach ([['TVA 19%', 19], ['TVA reduite 9%', 9], ['Exonere', 0]] as [$name, $rate]) {
            DB::table('product_service_taxes')->updateOrInsert(
                ['tax_name' => $name, 'created_by' => $this->companyId],
                ['rate' => $rate, 'creator_id' => $this->companyId, 'updated_at' => $now, 'created_at' => $now]
            );
        }

        $categoryIds = DB::table('product_service_categories')->where('created_by', $this->companyId)->pluck('id', 'name')->all();
        $unitIds = DB::table('product_service_units')->where('created_by', $this->companyId)->pluck('id', 'unit_name')->all();
        $taxIds = DB::table('product_service_taxes')->where('created_by', $this->companyId)->pluck('id', 'tax_name')->all();
        $warehouseIds = DB::table('warehouses')->where('created_by', $this->companyId)->whereIn('name', [
            'Cuisine Centrale DzPizza Alger',
            'Depot Ingredients Blida',
            'Point Vente Oran Akid Lotfi',
        ])->orderBy('id')->pluck('id')->values()->all();

        $products = [
            ['PIZ-CLS-MAR-M', 'Pizza Margherita M', 'Pizzas classiques', 'Taille M', 'product', 550, 260, ['TVA reduite 9%'], 'Sauce tomate maison, mozzarella, olives et origan', [45, 20, 25]],
            ['PIZ-CLS-MAR-L', 'Pizza Margherita L', 'Pizzas classiques', 'Taille L', 'product', 850, 410, ['TVA reduite 9%'], 'Grand format Margherita pour partage', [35, 14, 20]],
            ['PIZ-CLS-THON-M', 'Pizza Thon M', 'Pizzas classiques', 'Taille M', 'product', 750, 390, ['TVA reduite 9%'], 'Thon, oignon, olives, sauce tomate et mozzarella', [38, 18, 22]],
            ['PIZ-CLS-REINE-L', 'Pizza Reine L', 'Pizzas classiques', 'Taille L', 'product', 1150, 620, ['TVA reduite 9%'], 'Jambon dinde, champignons, mozzarella et sauce tomate', [30, 12, 18]],
            ['PIZ-SIG-CHAK-M', 'Pizza Chakchouka M', 'Pizzas signature', 'Taille M', 'product', 850, 430, ['TVA reduite 9%'], 'Poivrons grilles, tomate epicee, oeuf et fromage', [32, 16, 18]],
            ['PIZ-SIG-MERG-L', 'Pizza Merguez Algerienne L', 'Pizzas signature', 'Taille L', 'product', 1350, 780, ['TVA reduite 9%'], 'Merguez, poivrons, oignons, harissa douce et mozzarella', [28, 10, 16]],
            ['PIZ-SIG-4FR-L', 'Pizza Quatre Fromages L', 'Pizzas signature', 'Taille L', 'product', 1450, 860, ['TVA reduite 9%'], 'Mozzarella, cheddar, bleu, fromage fondu', [24, 10, 12]],
            ['PIZ-SIG-POUL-M', 'Pizza Poulet Creme M', 'Pizzas signature', 'Taille M', 'product', 950, 520, ['TVA reduite 9%'], 'Poulet marine, creme, champignons et fromage', [34, 14, 18]],
            ['PIZ-SIG-VEG-M', 'Pizza Vegetarienne M', 'Pizzas signature', 'Taille M', 'product', 780, 360, ['TVA reduite 9%'], 'Legumes grilles, olives, mais, tomate et mozzarella', [36, 18, 20]],
            ['PIZ-SIG-MER-L', 'Pizza Fruits de Mer L', 'Pizzas signature', 'Taille L', 'product', 1750, 1100, ['TVA reduite 9%'], 'Crevettes, calamars, ail, persil et mozzarella', [18, 8, 10]],
            ['ING-PATE-250', 'Paton pizza 250g', 'Ingredients pizza', 'Piece', 'product', 120, 55, ['TVA 19%'], 'Pate fraiche portion moyenne', [250, 400, 180]],
            ['ING-PATE-400', 'Paton pizza 400g', 'Ingredients pizza', 'Piece', 'product', 180, 85, ['TVA 19%'], 'Pate fraiche grand format', [200, 320, 150]],
            ['ING-FARINE-25', 'Farine pizza 25 kg', 'Ingredients pizza', 'Kg', 'product', 4200, 3500, ['TVA 19%'], 'Farine boulangere pour pate longue fermentation', [18, 60, 12]],
            ['ING-SAUCE-5L', 'Sauce tomate maison 5L', 'Ingredients pizza', 'Litre', 'product', 1800, 1150, ['TVA 19%'], 'Sauce tomate epicee preparee pour service', [22, 35, 12]],
            ['ING-MOZZA-KG', 'Mozzarella rapee 1 kg', 'Ingredients pizza', 'Kg', 'product', 1350, 980, ['TVA 19%'], 'Mozzarella speciale pizza', [65, 90, 40]],
            ['ING-OLIVE-KG', 'Olives noires rondelles 1 kg', 'Ingredients pizza', 'Kg', 'product', 850, 590, ['TVA 19%'], 'Olives noires tranchees pour garniture', [35, 50, 25]],
            ['ING-CHAMP-KG', 'Champignons eminces 1 kg', 'Ingredients pizza', 'Kg', 'product', 780, 520, ['TVA 19%'], 'Champignons frais eminces', [30, 42, 18]],
            ['ING-MERG-KG', 'Merguez halal 1 kg', 'Ingredients pizza', 'Kg', 'product', 1600, 1180, ['TVA 19%'], 'Merguez locale pour pizzas signature', [26, 34, 18]],
            ['DRK-COLA-33', 'Boisson cola 33cl', 'Boissons', 'Piece', 'product', 120, 75, ['TVA 19%'], 'Canette fraiche 33cl', [120, 160, 90]],
            ['DRK-HAMOUD-1L', 'Hamoud Boualem 1L', 'Boissons', 'Piece', 'product', 220, 145, ['TVA 19%'], 'Boisson gazeuse algerienne 1 litre', [80, 110, 70]],
            ['DST-TIRAMISU', 'Tiramisu maison', 'Desserts', 'Piece', 'product', 380, 210, ['TVA reduite 9%'], 'Dessert individuel cacao cafe', [45, 25, 30]],
            ['DST-PANNA', 'Panna cotta caramel', 'Desserts', 'Piece', 'product', 320, 180, ['TVA reduite 9%'], 'Dessert frais caramel', [40, 22, 25]],
            ['SRV-LIV-ALGER', 'Livraison Alger', 'Services livraison', 'Service', 'service', 250, 0, ['Exonere'], 'Frais livraison Alger centre et alentours', []],
            ['SRV-LIV-WILAYA', 'Livraison inter-wilaya', 'Services livraison', 'Service', 'service', 700, 0, ['Exonere'], 'Livraison grands comptes hors Alger', []],
        ];

        foreach ($products as [$sku, $name, $category, $unit, $type, $sale, $purchase, $taxNames, $description, $stock]) {
            DB::table('product_service_items')->updateOrInsert(
                ['sku' => $sku, 'created_by' => $this->companyId],
                [
                    'name' => $name,
                    'tax_ids' => json_encode(array_values(array_filter(array_map(fn ($tax) => $taxIds[$tax] ?? null, $taxNames)))),
                    'category_id' => $categoryIds[$category] ?? null,
                    'description' => $description,
                    'long_description' => $description,
                    'sale_price' => $sale,
                    'purchase_price' => $purchase,
                    'unit' => $unitIds[$unit] ?? null,
                    'image' => null,
                    'images' => null,
                    'type' => $type,
                    'is_active' => 1,
                    'creator_id' => $this->companyId,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            $productId = DB::table('product_service_items')
                ->where('sku', $sku)
                ->where('created_by', $this->companyId)
                ->value('id');

            foreach ($stock as $index => $quantity) {
                if (! isset($warehouseIds[$index])) {
                    continue;
                }

                DB::table('warehouse_stocks')->updateOrInsert(
                    ['product_id' => $productId, 'warehouse_id' => $warehouseIds[$index]],
                    ['quantity' => $quantity, 'updated_at' => $now, 'created_at' => $now]
                );
            }
        }
    }

    private function address(string $person, string $city, string $zip): array
    {
        return [
            'name' => $person,
            'address_line_1' => 'Centre ville '.$city,
            'address_line_2' => null,
            'city' => $city,
            'state' => $city,
            'country' => 'Algerie',
            'zip_code' => $zip,
        ];
    }
}
