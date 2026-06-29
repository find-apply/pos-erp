<?php

namespace Database\Seeders;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class VeterinaryAlgeriaSeeder extends Seeder
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

        $this->companyId = (int) $company->id;

        DB::transaction(function () {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');

            $this->clearOldBusinessData();
            $this->seedAccountStructure();
            $this->seedBankAccounts();
            $this->seedRevenueExpenseCategories();
            $this->seedPartners();
            $this->seedWarehouses();
            $this->seedVeterinaryCatalog();
            $this->seedPosSales();

            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        });

        $this->command?->info('Veterinary Algeria data seeded for company ID '.$this->companyId.'.');
    }

    private function clearOldBusinessData(): void
    {
        $allRows = [
            'pos_payments',
            'pos_items',
            'pos',
            'sales_invoice_item_taxes',
            'sales_invoice_items',
            'sales_invoices',
            'sales_invoice_return_item_taxes',
            'sales_invoice_return_items',
            'sales_invoice_returns',
            'purchase_invoice_item_taxes',
            'purchase_invoice_items',
            'purchase_invoices',
            'purchase_return_item_taxes',
            'purchase_return_items',
            'purchase_returns',
            'sales_proposal_item_taxes',
            'sales_proposal_items',
            'sales_proposals',
            'sales_quotation_item_taxes',
            'sales_quotation_items',
            'sales_quotations',
            'credit_note_applications',
            'credit_note_item_taxes',
            'credit_note_items',
            'credit_notes',
            'debit_note_applications',
            'debit_note_item_taxes',
            'debit_note_items',
            'debit_notes',
            'customer_payment_allocations',
            'customer_payments',
            'vendor_payment_allocations',
            'vendor_payments',
            'journal_entry_items',
            'journal_entries',
            'warehouse_stocks',
        ];

        foreach ($allRows as $table) {
            DB::table($table)->delete();
        }

        $companyRows = [
            'bank_accounts',
            'bank_transactions',
            'bank_transfers',
            'chart_of_accounts',
            'customers',
            'vendors',
            'expense_categories',
            'expenses',
            'revenue_categories',
            'revenues',
            'product_service_items',
            'product_service_categories',
            'product_service_units',
            'product_service_taxes',
            'transfers',
            'warehouses',
        ];

        foreach ($companyRows as $table) {
            DB::table($table)->where('created_by', $this->companyId)->delete();
        }
    }

    private function seedAccountStructure(): void
    {
        $now = now();

        $categories = [
            'AST' => ['name' => 'Actifs', 'type' => 'assets', 'description' => 'Comptes de la classe 2/3/4/5 a solde debiteur'],
            'LIB' => ['name' => 'Passifs', 'type' => 'liabilities', 'description' => 'Dettes fournisseurs, fiscales et sociales'],
            'EQT' => ['name' => 'Capitaux propres', 'type' => 'equity', 'description' => 'Capital, reserves et resultat'],
            'REV' => ['name' => 'Produits', 'type' => 'revenue', 'description' => 'Ventes et autres produits'],
            'EXP' => ['name' => 'Charges', 'type' => 'expenses', 'description' => 'Achats, frais et charges courantes'],
        ];

        foreach ($categories as $code => $data) {
            DB::table('account_categories')->updateOrInsert(
                ['code' => $code, 'created_by' => $this->companyId],
                [
                    'name' => $data['name'],
                    'type' => $data['type'],
                    'description' => $data['description'],
                    'is_active' => 1,
                    'creator_id' => $this->companyId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }

        $categoryIds = DB::table('account_categories')
            ->where('created_by', $this->companyId)
            ->pluck('id', 'code')
            ->all();

        $types = [
            ['AST', 'CA', 'Actifs courants', 'debit', 'Tresorerie, creances, stocks et TVA deductible'],
            ['AST', 'FA', 'Immobilisations', 'debit', 'Materiel, amenagements et immobilisations'],
            ['AST', 'OA', 'Autres actifs', 'debit', 'Autres actifs et avances'],
            ['LIB', 'CL', 'Passifs courants', 'credit', 'Dettes a court terme'],
            ['LIB', 'LTL', 'Passifs non courants', 'credit', 'Emprunts et dettes long terme'],
            ['EQT', 'SC', 'Capital social', 'credit', 'Capital et apports'],
            ['EQT', 'RE', 'Resultat et reserves', 'credit', 'Resultat, reserves et report a nouveau'],
            ['REV', 'SR', 'Ventes', 'credit', 'Ventes de produits et prestations veterinaires'],
            ['REV', 'OI', 'Autres produits', 'credit', 'Autres produits de gestion'],
            ['EXP', 'COGS', 'Achats consommes', 'debit', 'Cout des produits veterinaires vendus'],
            ['EXP', 'OE', 'Charges operationnelles', 'debit', 'Loyer, salaires, transport et publicite'],
            ['EXP', 'AE', 'Charges administratives', 'debit', 'Honoraires, assurances et frais administratifs'],
            ['EXP', 'FE', 'Charges financieres', 'debit', 'Frais bancaires et interets'],
            ['EXP', 'TE', 'Impots et taxes', 'debit', 'Taxes et impots'],
            ['EXP', 'OX', 'Autres charges', 'debit', 'Charges diverses'],
        ];

        foreach ($types as [$categoryCode, $code, $name, $normalBalance, $description]) {
            DB::table('account_types')->updateOrInsert(
                ['code' => $code, 'created_by' => $this->companyId],
                [
                    'category_id' => $categoryIds[$categoryCode],
                    'name' => $name,
                    'normal_balance' => $normalBalance,
                    'description' => $description,
                    'is_active' => 1,
                    'is_system_type' => 1,
                    'creator_id' => $this->companyId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }

        $typeIds = DB::table('account_types')
            ->where('created_by', $this->companyId)
            ->pluck('id', 'code')
            ->all();

        $accounts = [
            ['101000', 'Capital social', 'SC', 'credit', 2500000, 'Capital de la societe'],
            ['106000', 'Reserves', 'RE', 'credit', 350000, 'Reserves constituees'],
            ['120000', 'Resultat de l exercice', 'RE', 'credit', 0, 'Resultat courant'],
            ['213500', 'Amenagement clinique veterinaire', 'FA', 'debit', 850000, 'Amenagements et installations'],
            ['215400', 'Materiel medical veterinaire', 'FA', 'debit', 1200000, 'Echographe, autoclave, tables et cages'],
            ['218300', 'Materiel informatique', 'FA', 'debit', 280000, 'Postes de caisse et informatique'],
            ['300000', 'Stocks produits veterinaires', 'CA', 'debit', 1800000, 'Stock de medicaments, vaccins et aliments'],
            ['370000', 'Stocks marchandises', 'CA', 'debit', 0, 'Marchandises disponibles a la vente'],
            ['401000', 'Fournisseurs locaux', 'CL', 'credit', 420000, 'Dettes fournisseurs Algerie'],
            ['411000', 'Clients', 'CA', 'debit', 310000, 'Creances clients'],
            ['445620', 'TVA deductible 19%', 'CA', 'debit', 0, 'TVA deductible sur achats'],
            ['445710', 'TVA collectee 19%', 'CL', 'credit', 0, 'TVA collectee sur ventes'],
            ['512001', 'Banque BNA - compte courant', 'CA', 'debit', 1850000, 'Compte courant BNA'],
            ['512002', 'Banque CPA - exploitation', 'CA', 'debit', 950000, 'Compte exploitation CPA'],
            ['530000', 'Caisse principale DZD', 'CA', 'debit', 180000, 'Caisse de la clinique'],
            ['607000', 'Achats produits veterinaires', 'COGS', 'debit', 0, 'Achats medicaments et consommables'],
            ['613200', 'Loyers clinique', 'OE', 'debit', 0, 'Loyer local commercial'],
            ['622600', 'Honoraires veterinaire consultant', 'AE', 'debit', 0, 'Prestations externes'],
            ['626000', 'Frais postaux et telecom', 'AE', 'debit', 0, 'Internet et telephone'],
            ['627000', 'Services bancaires', 'FE', 'debit', 0, 'Frais bancaires'],
            ['641000', 'Salaires personnel', 'OE', 'debit', 0, 'Salaires et charges personnel'],
            ['700000', 'Ventes produits veterinaires', 'SR', 'credit', 0, 'Ventes medicaments, vaccins et aliments'],
            ['706000', 'Prestations de services veterinaires', 'SR', 'credit', 0, 'Consultations, vaccination et soins'],
            ['708000', 'Produits accessoires', 'OI', 'credit', 0, 'Autres produits de gestion'],
        ];

        foreach ($accounts as [$code, $name, $typeCode, $normalBalance, $balance, $description]) {
            DB::table('chart_of_accounts')->insert([
                'account_code' => $code,
                'account_name' => $name,
                'account_type_id' => $typeIds[$typeCode],
                'parent_account_id' => null,
                'level' => 1,
                'normal_balance' => $normalBalance,
                'opening_balance' => $balance,
                'current_balance' => $balance,
                'is_active' => 1,
                'is_system_account' => 1,
                'description' => $description,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function seedBankAccounts(): void
    {
        $now = now();
        $accounts = DB::table('chart_of_accounts')
            ->where('created_by', $this->companyId)
            ->pluck('id', 'account_code')
            ->all();

        $bankAccounts = [
            ['00799999000123456789', 'Compte courant exploitation', 'BNA - Banque Nationale d Algerie', 'Agence Blida Centre', '0', 1200000, 1850000, 'DZ5800709999000123456789', 'BNALDZAL', '512001'],
            ['00499999000987654321', 'Compte paiement fournisseurs', 'CPA - Credit Populaire d Algerie', 'Agence Alger Didouche', '0', 650000, 950000, 'DZ5800409999000987654321', 'CPALDZAL', '512002'],
            ['00399999000555555555', 'Caisse clinique', 'Caisse interne', 'Comptoir Vetralis', '0', 120000, 180000, null, null, '530000'],
        ];

        foreach ($bankAccounts as [$number, $name, $bank, $branch, $type, $opening, $current, $iban, $swift, $glCode]) {
            DB::table('bank_accounts')->insert([
                'account_number' => $number,
                'account_name' => $name,
                'bank_name' => $bank,
                'branch_name' => $branch,
                'account_type' => $type,
                'payment_gateway' => null,
                'opening_balance' => $opening,
                'current_balance' => $current,
                'iban' => $iban,
                'swift_code' => $swift,
                'routing_number' => null,
                'is_active' => 1,
                'gl_account_id' => $accounts[$glCode] ?? null,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function seedRevenueExpenseCategories(): void
    {
        $now = now();
        $accounts = DB::table('chart_of_accounts')
            ->where('created_by', $this->companyId)
            ->pluck('id', 'account_code')
            ->all();

        $revenues = [
            ['VTE-PROD', 'Ventes produits veterinaires', '700000', 'Medicaments, vaccins, antiparasitaires et aliments'],
            ['VTE-SERV', 'Prestations veterinaires', '706000', 'Consultations, vaccination et visites elevage'],
            ['VTE-ACC', 'Produits accessoires', '708000', 'Accessoires et produits divers'],
        ];

        foreach ($revenues as [$code, $name, $accountCode, $description]) {
            DB::table('revenue_categories')->insert([
                'category_name' => $name,
                'category_code' => $code,
                'description' => $description,
                'is_active' => '1',
                'gl_account_id' => $accounts[$accountCode] ?? null,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $expenses = [
            ['ACH-VET', 'Achats produits veterinaires', '607000', 'Achats medicaments, vaccins et consommables'],
            ['LOY-CLN', 'Loyer clinique', '613200', 'Loyer local et charges locatives'],
            ['HON-VET', 'Honoraires veterinaires', '622600', 'Veterinaire consultant et prestations externes'],
            ['TEL-INT', 'Telephone et internet', '626000', 'Frais telecom et internet'],
            ['FR-BNK', 'Frais bancaires', '627000', 'Commissions et frais de banque'],
            ['SAL-PER', 'Salaires personnel', '641000', 'Personnel clinique et commercial'],
        ];

        foreach ($expenses as [$code, $name, $accountCode, $description]) {
            DB::table('expense_categories')->insert([
                'category_name' => $name,
                'category_code' => $code,
                'description' => $description,
                'is_active' => '1',
                'gl_account_id' => $accounts[$accountCode] ?? null,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
    private function seedPartners(): void
    {
        $now = now();
        $clientUsers = User::where('created_by', $this->companyId)->where('type', 'client')->pluck('id')->values();
        $vendorUsers = User::where('created_by', $this->companyId)->where('type', 'vendor')->pluck('id')->values();

        $customers = [
            ['CLT-001', 'Clinique Veterinaire El Amel', 'Dr. Samira Khelifi', 'contact@elamel-vet.dz', '0550123456', 'Alger', '16000'],
            ['CLT-002', 'Ferme Avicole Mitidja', 'Karim Bensalem', 'achats@mitidja-avicole.dz', '0560234567', 'Blida', '09000'],
            ['CLT-003', 'Ecurie Tell Atlas', 'Nadia Rahmani', 'contact@tell-atlas.dz', '0770345678', 'Medea', '26000'],
            ['CLT-004', 'Animalerie Les Pattes', 'Yacine Haddad', 'commande@lespattes.dz', '0550456789', 'Oran', '31000'],
            ['CLT-005', 'Cooperative Laitiere Soummam', 'Amina Ziani', 'veterinaire@soummam-coop.dz', '0660567890', 'Bejaia', '06000'],
        ];

        foreach ($customers as $index => [$code, $company, $person, $email, $mobile, $city, $zip]) {
            $address = [
                'name' => $person,
                'address_line_1' => 'Zone activite '.$city,
                'address_line_2' => null,
                'city' => $city,
                'state' => $city,
                'country' => 'Algerie',
                'zip_code' => $zip,
            ];

            DB::table('customers')->insert([
                'user_id' => $clientUsers[$index] ?? null,
                'customer_code' => $code,
                'company_name' => $company,
                'contact_person_name' => $person,
                'contact_person_email' => $email,
                'contact_person_mobile' => $mobile,
                'tax_number' => 'NIF '.str_pad((string) (100000000000000 + $index), 15, '0', STR_PAD_LEFT),
                'payment_terms' => '30 jours',
                'billing_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                'shipping_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                'same_as_billing' => 1,
                'notes' => 'Client veterinaire Algerie',
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $vendors = [
            ['FRN-001', 'Sarl Vetpharm Algerie', 'Mohamed Ait Saada', 'commercial@vetpharm.dz', '0551122334', 'Alger', '16000'],
            ['FRN-002', 'BioVet Distribution', 'Leila Merabet', 'contact@biovet.dz', '0561987654', 'Constantine', '25000'],
            ['FRN-003', 'Agro Feed Services', 'Sofiane Meziane', 'supply@agrofeed.dz', '0771765432', 'Setif', '19000'],
        ];

        foreach ($vendors as $index => [$code, $company, $person, $email, $mobile, $city, $zip]) {
            $address = [
                'name' => $person,
                'address_line_1' => 'Zone industrielle '.$city,
                'address_line_2' => null,
                'city' => $city,
                'state' => $city,
                'country' => 'Algerie',
                'zip_code' => $zip,
            ];

            DB::table('vendors')->insert([
                'user_id' => $vendorUsers[$index] ?? null,
                'vendor_code' => $code,
                'company_name' => $company,
                'contact_person_name' => $person,
                'contact_person_email' => $email,
                'contact_person_mobile' => $mobile,
                'tax_number' => 'NIF '.str_pad((string) (200000000000000 + $index), 15, '0', STR_PAD_LEFT),
                'payment_terms' => '30 jours fin de mois',
                'billing_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                'shipping_address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                'same_as_billing' => 1,
                'notes' => 'Fournisseur produits veterinaires',
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function seedWarehouses(): void
    {
        $now = now();
        $warehouses = [
            ['Depot Central Vetralis', 'Zone industrielle Ouled Yaich', 'Blida', '09000', '0550102030', 'depot.blida@vetralis.dz'],
            ['Stock Alger Est', 'Bab Ezzouar, lot activite 12', 'Alger', '16024', '0550112233', 'stock.alger@vetralis.dz'],
            ['Depot Oran Ouest', 'Es Senia, zone logistique', 'Oran', '31000', '0550445566', 'stock.oran@vetralis.dz'],
        ];

        foreach ($warehouses as [$name, $address, $city, $zip, $phone, $email]) {
            DB::table('warehouses')->insert([
                'name' => $name,
                'address' => $address,
                'city' => $city,
                'zip_code' => $zip,
                'phone' => $phone,
                'email' => $email,
                'is_active' => 1,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function seedVeterinaryCatalog(): void
    {
        $now = now();

        $categories = [
            ['Medicaments veterinaires', '#10b77f'],
            ['Vaccins et immunologie', '#2563eb'],
            ['Antiparasitaires', '#f59e0b'],
            ['Aliments et complements', '#84cc16'],
            ['Materiel clinique', '#8b5cf6'],
            ['Services veterinaires', '#ec4899'],
        ];

        foreach ($categories as [$name, $color]) {
            DB::table('product_service_categories')->insert([
                'name' => $name,
                'color' => $color,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (['Unite', 'Boite', 'Flacon', 'Sachet', 'Kg', 'Litre', 'Dose', 'Seringue', 'Service'] as $unit) {
            DB::table('product_service_units')->insert([
                'unit_name' => $unit,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $taxes = [
            ['TVA 19%', 19],
            ['TVA reduite 9%', 9],
            ['Exonere', 0],
        ];

        foreach ($taxes as [$name, $rate]) {
            DB::table('product_service_taxes')->insert([
                'tax_name' => $name,
                'rate' => $rate,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $categoryIds = DB::table('product_service_categories')->where('created_by', $this->companyId)->pluck('id', 'name')->all();
        $unitIds = DB::table('product_service_units')->where('created_by', $this->companyId)->pluck('id', 'unit_name')->all();
        $taxIds = DB::table('product_service_taxes')->where('created_by', $this->companyId)->pluck('id', 'tax_name')->all();
        $warehouseIds = DB::table('warehouses')->where('created_by', $this->companyId)->pluck('id')->values()->all();

        $products = [
            ['VET-MED-001', 'Amoxicilline injectable 100 ml', 'Medicaments veterinaires', 'Flacon', 'product', 1850, 1250, ['TVA 19%'], 'Antibiotique injectable pour bovins, ovins et caprins', [42, 28, 18]],
            ['VET-MED-002', 'Oxytetracycline LA 100 ml', 'Medicaments veterinaires', 'Flacon', 'product', 2450, 1700, ['TVA 19%'], 'Antibiotique longue action usage veterinaire', [36, 24, 14]],
            ['VET-MED-003', 'Anti-inflammatoire Ketoprofen 100 ml', 'Medicaments veterinaires', 'Flacon', 'product', 3200, 2350, ['TVA 19%'], 'Traitement anti-inflammatoire et antalgique', [24, 16, 10]],
            ['VET-VAC-001', 'Vaccin clostridien ovins caprins 50 doses', 'Vaccins et immunologie', 'Flacon', 'product', 6800, 5100, ['TVA reduite 9%'], 'Vaccin multivalent chaine du froid 2-8 C', [18, 12, 8]],
            ['VET-VAC-002', 'Vaccin Newcastle volaille 1000 doses', 'Vaccins et immunologie', 'Dose', 'product', 5200, 3900, ['TVA reduite 9%'], 'Vaccin aviaire pour elevages de volaille', [30, 20, 12]],
            ['VET-PAR-001', 'Ivermectine 1% injectable 50 ml', 'Antiparasitaires', 'Flacon', 'product', 2700, 1900, ['TVA 19%'], 'Antiparasitaire interne et externe', [45, 30, 20]],
            ['VET-PAR-002', 'Albendazole suspension 1 litre', 'Antiparasitaires', 'Litre', 'product', 2100, 1450, ['TVA 19%'], 'Vermifuge pour bovins et petits ruminants', [38, 26, 16]],
            ['VET-ALM-001', 'Complement mineral bovin 25 kg', 'Aliments et complements', 'Sachet', 'product', 4200, 3100, ['TVA reduite 9%'], 'CMV pour soutien croissance et production laitiere', [22, 18, 10]],
            ['VET-ALM-002', 'Lait maternise chiots chatons 400 g', 'Aliments et complements', 'Boite', 'product', 1650, 980, ['TVA 19%'], 'Aliment complementaire jeunes animaux', [60, 35, 22]],
            ['VET-MAT-001', 'Seringues steriles 20 ml boite de 100', 'Materiel clinique', 'Boite', 'product', 1900, 1200, ['TVA 19%'], 'Consommable injection clinique et elevage', [55, 40, 25]],
            ['VET-MAT-002', 'Gants nitrile boite de 100', 'Materiel clinique', 'Boite', 'product', 1450, 900, ['TVA 19%'], 'Protection examen et intervention', [80, 50, 35]],
            ['VET-MAT-003', 'Thermometre digital veterinaire', 'Materiel clinique', 'Unite', 'product', 2300, 1500, ['TVA 19%'], 'Thermometre rapide pour clinique et terrain', [20, 14, 10]],
            ['VET-SRV-001', 'Consultation veterinaire generale', 'Services veterinaires', 'Service', 'service', 2500, 0, ['Exonere'], 'Consultation et diagnostic general', []],
            ['VET-SRV-002', 'Vaccination chien/chat', 'Services veterinaires', 'Service', 'service', 3500, 0, ['Exonere'], 'Acte de vaccination et carnet sanitaire', []],
            ['VET-SRV-003', 'Visite elevage bovin', 'Services veterinaires', 'Service', 'service', 12000, 0, ['TVA reduite 9%'], 'Deplacement, diagnostic troupeau et rapport', []],
        ];

        foreach ($products as [$sku, $name, $category, $unit, $type, $sale, $purchase, $taxNames, $description, $stock]) {
            $productId = DB::table('product_service_items')->insertGetId([
                'name' => $name,
                'sku' => $sku,
                'tax_ids' => json_encode(array_values(array_filter(array_map(fn ($tax) => $taxIds[$tax] ?? null, $taxNames)))),
                'category_id' => $categoryIds[$category],
                'description' => $description,
                'long_description' => $description,
                'sale_price' => $sale,
                'purchase_price' => $purchase,
                'unit' => $unitIds[$unit],
                'image' => null,
                'images' => null,
                'type' => $type,
                'is_active' => 1,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($stock as $index => $quantity) {
                if (! isset($warehouseIds[$index])) {
                    continue;
                }

                DB::table('warehouse_stocks')->insert([
                    'product_id' => $productId,
                    'warehouse_id' => $warehouseIds[$index],
                    'quantity' => $quantity,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    private function seedPosSales(): void
    {
        $now = now();
        $customers = DB::table('customers')->where('created_by', $this->companyId)->pluck('id')->values()->all();
        $warehouses = DB::table('warehouses')->where('created_by', $this->companyId)->pluck('id')->values()->all();
        $bankAccountId = DB::table('bank_accounts')->where('created_by', $this->companyId)->value('id');
        $products = DB::table('product_service_items')
            ->where('created_by', $this->companyId)
            ->where('type', '!=', 'service')
            ->orderBy('id')
            ->get();
        $taxRatesById = DB::table('product_service_taxes')
            ->where('created_by', $this->companyId)
            ->pluck('rate', 'id')
            ->all();

        $sales = [
            [5, [[0, 2], [8, 3], [9, 2]], 0],
            [4, [[5, 1], [6, 2], [10, 1]], 250],
            [3, [[3, 1], [4, 1], [11, 2]], 0],
            [2, [[1, 2], [7, 1], [8, 4]], 500],
            [1, [[0, 1], [2, 1], [5, 2], [10, 3]], 0],
            [0, [[6, 2], [9, 5], [11, 1]], 150],
        ];

        foreach ($sales as $index => [$daysAgo, $lines, $discount]) {
            $date = Carbon::now()->subDays($daysAgo);
            $warehouseId = $warehouses[$index % count($warehouses)];
            $posId = DB::table('pos')->insertGetId([
                'sale_number' => '#VET-POS'.str_pad((string) ($index + 1), 5, '0', STR_PAD_LEFT),
                'customer_id' => $customers[$index % count($customers)] ?? null,
                'warehouse_id' => $warehouseId,
                'pos_date' => $date->toDateString(),
                'status' => 'completed',
                'bank_account_id' => $bankAccountId,
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $date,
                'updated_at' => $date,
            ]);

            $gross = 0;
            foreach ($lines as [$productIndex, $quantity]) {
                $product = $products[$productIndex] ?? null;
                if (! $product) {
                    continue;
                }

                $subtotal = (float) $product->sale_price * $quantity;
                $taxRate = 0;
                foreach (json_decode((string) $product->tax_ids, true) ?: [] as $taxId) {
                    $taxRate += ((float) ($taxRatesById[$taxId] ?? 0)) / 100;
                }
                $taxAmount = round($subtotal * $taxRate, 2);
                $total = $subtotal + $taxAmount;
                $gross += $total;

                DB::table('pos_items')->insert([
                    'pos_id' => $posId,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'price' => $product->sale_price,
                    'subtotal' => $subtotal,
                    'tax_ids' => $product->tax_ids,
                    'tax_amount' => $taxAmount,
                    'total_amount' => $total,
                    'creator_id' => $this->companyId,
                    'created_by' => $this->companyId,
                    'created_at' => $date,
                    'updated_at' => $date,
                ]);
            }

            DB::table('pos_payments')->insert([
                'pos_id' => $posId,
                'discount' => $discount,
                'amount' => $gross,
                'discount_amount' => max(0, $gross - $discount),
                'creator_id' => $this->companyId,
                'created_by' => $this->companyId,
                'created_at' => $date,
                'updated_at' => $date,
            ]);
        }
    }
}
