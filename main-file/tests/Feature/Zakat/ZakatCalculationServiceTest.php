<?php

namespace Tests\Feature\Zakat;

use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Workdo\Account\Models\BankAccount;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\Expense;
use Workdo\ProductService\Models\ProductServiceItem;
use Workdo\ProductService\Models\WarehouseStock;
use Workdo\Zakat\Services\ZakatCalculationService;

class ZakatCalculationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_calculates_business_zakat_from_assets_and_due_credit(): void
    {
        $company = $this->seedBusinessData();
        $this->actingAs($company);

        $calculation = app(ZakatCalculationService::class)->createCalculation([
            'calculation_date' => '2026-07-01',
            'haul_start_date' => '2025-07-01',
            'nisab_amount' => 100,
            'rate_percent' => 2.5,
            'inventory_valuation_method' => 'sale_price',
            'liability_due_within_days' => 354,
            'receivable_policy' => 'collectible',
        ]);

        $this->assertSame(1000.00, (float) $calculation->cash_amount);
        $this->assertSame(500.00, (float) $calculation->inventory_amount);
        $this->assertSame(700.00, (float) $calculation->receivable_amount);
        $this->assertSame(200.00, (float) $calculation->deductible_liabilities_amount);
        $this->assertSame(2000.00, (float) $calculation->zakatable_amount);
        $this->assertSame(50.00, (float) $calculation->zakat_due);
    }

    public function test_finalized_calculation_keeps_the_original_snapshot(): void
    {
        $company = $this->seedBusinessData();
        $this->actingAs($company);

        $service = app(ZakatCalculationService::class);
        $calculation = $service->createCalculation([
            'calculation_date' => '2026-07-01',
            'haul_start_date' => '2025-07-01',
            'nisab_amount' => 100,
            'rate_percent' => 2.5,
            'inventory_valuation_method' => 'sale_price',
            'liability_due_within_days' => 354,
            'receivable_policy' => 'collectible',
        ]);

        BankAccount::where('created_by', $company->id)->first()->update(['current_balance' => 9999]);
        WarehouseStock::first()->update(['quantity' => 999]);

        $finalized = $service->finalize($calculation);

        $this->assertSame('finalized', $finalized->status);
        $this->assertSame(2000.00, (float) $finalized->zakatable_amount);
        $this->assertSame(50.00, (float) $finalized->zakat_due);
    }

    public function test_recording_payment_creates_posted_expense_and_decreases_bank_balance(): void
    {
        $company = $this->seedBusinessData();
        $this->actingAs($company);

        $service = app(ZakatCalculationService::class);
        $calculation = $service->finalize($service->createCalculation([
            'calculation_date' => '2026-07-01',
            'haul_start_date' => '2025-07-01',
            'nisab_amount' => 100,
            'rate_percent' => 2.5,
            'inventory_valuation_method' => 'sale_price',
            'liability_due_within_days' => 354,
            'receivable_policy' => 'collectible',
        ]));

        $bankAccount = BankAccount::where('created_by', $company->id)->first();

        $service->recordPayment($calculation, [
            'bank_account_id' => $bankAccount->id,
            'payment_date' => '2026-07-02',
            'amount' => 50,
            'reference_number' => 'ZAK-PAY-001',
            'notes' => 'Paid from test account',
        ]);

        $this->assertDatabaseHas('expenses', [
            'amount' => 50,
            'status' => 'posted',
            'created_by' => $company->id,
        ]);
        $this->assertSame(950.00, (float) $bankAccount->fresh()->current_balance);
        $this->assertSame(0.00, (float) $calculation->fresh()->remaining_amount);
    }

    private function seedBusinessData(): User
    {
        $company = User::create([
            'name' => 'Zakat Test Company',
            'email' => 'zakat-company@example.test',
            'password' => 'password',
            'type' => 'company',
            'email_verified_at' => now(),
        ]);

        $bankGlAccount = ChartOfAccount::create([
            'account_code' => '1010',
            'account_name' => 'Bank Account - Main',
            'account_type_id' => $this->expenseTypeId($company),
            'normal_balance' => 'debit',
            'is_active' => true,
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ]);

        BankAccount::create([
            'account_number' => 'BA-001',
            'account_name' => 'Main Bank',
            'bank_name' => 'Test Bank',
            'current_balance' => 1000,
            'opening_balance' => 1000,
            'is_active' => true,
            'gl_account_id' => $bankGlAccount->id,
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ]);

        $warehouse = Warehouse::create([
            'name' => 'Main Warehouse',
            'address' => 'Address',
            'city' => 'City',
            'zip_code' => '16000',
            'is_active' => true,
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ]);

        $product = ProductServiceItem::create([
            'name' => 'Trade Product',
            'sale_price' => 50,
            'purchase_price' => 30,
            'type' => 'product',
            'is_active' => true,
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ]);

        WarehouseStock::create([
            'warehouse_id' => $warehouse->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        $customer = User::create([
            'name' => 'Customer',
            'email' => 'zakat-customer@example.test',
            'password' => 'password',
            'type' => 'client',
            'email_verified_at' => now(),
            'created_by' => $company->id,
        ]);

        SalesInvoice::create([
            'invoice_number' => 'SI-ZAK-001',
            'invoice_date' => '2026-06-01',
            'due_date' => '2026-06-30',
            'customer_id' => $customer->id,
            'total_amount' => 700,
            'balance_amount' => 700,
            'status' => 'posted',
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ]);

        $vendor = User::create([
            'name' => 'Vendor',
            'email' => 'zakat-vendor@example.test',
            'password' => 'password',
            'type' => 'vendor',
            'email_verified_at' => now(),
            'created_by' => $company->id,
        ]);

        PurchaseInvoice::create([
            'invoice_number' => 'PI-ZAK-001',
            'invoice_date' => '2026-06-01',
            'due_date' => '2026-07-15',
            'vendor_id' => $vendor->id,
            'total_amount' => 200,
            'balance_amount' => 200,
            'status' => 'posted',
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ]);

        return $company;
    }

    private function expenseTypeId(User $company): int
    {
        $category = \Workdo\Account\Models\AccountCategory::create([
            'name' => 'Expenses',
            'code' => 'EXP',
            'type' => 'expenses',
            'is_active' => true,
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ]);

        return \Workdo\Account\Models\AccountType::create([
            'category_id' => $category->id,
            'name' => 'Other Expenses',
            'code' => 'OX',
            'normal_balance' => 'debit',
            'is_active' => true,
            'is_system_type' => true,
            'creator_id' => $company->id,
            'created_by' => $company->id,
        ])->id;
    }
}
