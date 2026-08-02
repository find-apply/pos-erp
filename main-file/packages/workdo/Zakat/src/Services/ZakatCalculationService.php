<?php

namespace Workdo\Zakat\Services;

use App\Models\PurchaseInvoice;
use App\Models\SalesInvoice;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Workdo\Account\Models\AccountCategory;
use Workdo\Account\Models\AccountType;
use Workdo\Account\Models\BankAccount;
use Workdo\Account\Models\BankTransaction;
use Workdo\Account\Models\ChartOfAccount;
use Workdo\Account\Models\Expense;
use Workdo\Account\Models\ExpenseCategories;
use Workdo\Account\Models\JournalEntry;
use Workdo\Account\Services\BankTransactionsService;
use Workdo\Account\Services\JournalService;
use Workdo\ProductService\Models\WarehouseStock;
use Workdo\Zakat\Models\ZakatAdjustment;
use Workdo\Zakat\Models\ZakatCalculation;
use Workdo\Zakat\Models\ZakatPayment;
use Workdo\Zakat\Models\ZakatSetting;

class ZakatCalculationService
{
    public function __construct(
        private JournalService $journalService,
        private BankTransactionsService $bankTransactionsService
    ) {
    }

    public function getSettings(?int $companyId = null): ZakatSetting
    {
        $companyId = $companyId ?: creatorId();

        return ZakatSetting::firstOrCreate(
            ['created_by' => $companyId],
            [
                'nisab_amount' => 0,
                'rate_percent' => 2.50,
                'haul_start_date' => now()->subDays(354)->toDateString(),
                'inventory_valuation_method' => 'sale_price',
                'liability_due_within_days' => 354,
                'receivable_policy' => 'collectible',
                'show_guidance' => true,
                'creator_id' => Auth::id(),
                'created_by' => $companyId,
            ]
        );
    }

    public function updateSettings(array $data, ?int $companyId = null): ZakatSetting
    {
        $setting = $this->getSettings($companyId);
        $setting->update([
            'nisab_amount' => $this->money($data['nisab_amount'] ?? $setting->nisab_amount),
            'rate_percent' => $this->money($data['rate_percent'] ?? $setting->rate_percent),
            'haul_start_date' => $data['haul_start_date'] ?? $setting->haul_start_date,
            'inventory_valuation_method' => $data['inventory_valuation_method'] ?? $setting->inventory_valuation_method,
            'liability_due_within_days' => (int) ($data['liability_due_within_days'] ?? $setting->liability_due_within_days),
            'receivable_policy' => $data['receivable_policy'] ?? $setting->receivable_policy,
            'show_guidance' => array_key_exists('show_guidance', $data) ? (bool) $data['show_guidance'] : $setting->show_guidance,
        ]);

        return $setting->fresh();
    }

    public function preview(array $data = [], ?int $companyId = null): array
    {
        $companyId = $companyId ?: creatorId();
        $settings = $this->getSettings($companyId);
        $payload = $this->payloadFromInput($data, $settings);
        $lines = $this->buildLines($payload, $companyId);
        $summary = $this->summarizeLines($lines, $payload);

        return [
            'payload' => $payload,
            'summary' => $summary,
            'lines' => $lines,
            'guidance' => $this->guidance(),
        ];
    }

    public function createCalculation(array $data, ?int $companyId = null): ZakatCalculation
    {
        $companyId = $companyId ?: creatorId();
        $settings = $this->getSettings($companyId);
        $payload = $this->payloadFromInput($data, $settings);
        $lines = $this->buildLines($payload, $companyId);
        $summary = $this->summarizeLines($lines, $payload);

        return DB::transaction(function () use ($companyId, $payload, $summary, $lines, $data) {
            $calculation = ZakatCalculation::create([
                'calculation_date' => $payload['calculation_date'],
                'haul_start_date' => $payload['haul_start_date'],
                'nisab_amount' => $payload['nisab_amount'],
                'rate_percent' => $payload['rate_percent'],
                'inventory_valuation_method' => $payload['inventory_valuation_method'],
                'liability_due_within_days' => $payload['liability_due_within_days'],
                'receivable_policy' => $payload['receivable_policy'],
                'cash_amount' => $summary['cash_amount'],
                'inventory_amount' => $summary['inventory_amount'],
                'receivable_amount' => $summary['receivable_amount'],
                'deductible_liabilities_amount' => $summary['deductible_liabilities_amount'],
                'manual_additions_amount' => $summary['manual_additions_amount'],
                'manual_deductions_amount' => $summary['manual_deductions_amount'],
                'zakatable_amount' => $summary['zakatable_amount'],
                'zakat_due' => $summary['zakat_due'],
                'paid_amount' => 0,
                'remaining_amount' => $summary['zakat_due'],
                'is_nisab_met' => $summary['is_nisab_met'],
                'is_haul_met' => $summary['is_haul_met'],
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
                'creator_id' => Auth::id(),
                'created_by' => $companyId,
            ]);

            foreach ($lines as $line) {
                $calculation->lines()->create(array_merge($line, [
                    'creator_id' => Auth::id(),
                    'created_by' => $companyId,
                ]));
            }

            foreach ($this->cleanAdjustments($data['adjustments'] ?? []) as $adjustment) {
                ZakatAdjustment::create([
                    'zakat_calculation_id' => $calculation->id,
                    'adjustment_type' => $adjustment['adjustment_type'],
                    'title' => $adjustment['title'],
                    'amount' => $adjustment['amount'],
                    'reason' => $adjustment['reason'],
                    'creator_id' => Auth::id(),
                    'created_by' => $companyId,
                ]);
            }

            return $calculation->fresh(['lines', 'adjustments']);
        });
    }

    public function finalize(ZakatCalculation $calculation): ZakatCalculation
    {
        if ($calculation->status === 'finalized') {
            return $calculation;
        }

        $calculation->update([
            'status' => 'finalized',
            'finalized_at' => now(),
        ]);

        return $calculation->fresh(['lines', 'adjustments', 'payments']);
    }

    public function recordPayment(ZakatCalculation $calculation, array $data): ZakatPayment
    {
        if ($calculation->status !== 'finalized') {
            throw new \Exception(__('Finalize the zakat calculation before recording a payment.'));
        }

        $amount = $this->money($data['amount'] ?? 0);
        if ($amount <= 0) {
            throw new \Exception(__('Payment amount must be greater than zero.'));
        }
        if ($amount > (float) $calculation->remaining_amount + 0.01) {
            throw new \Exception(__('Payment amount cannot exceed the remaining zakat amount.'));
        }

        $companyId = $calculation->created_by;
        $bankAccount = BankAccount::where('id', $data['bank_account_id'] ?? null)
            ->where('created_by', $companyId)
            ->first();

        if (!$bankAccount) {
            throw new \Exception(__('Bank account not found.'));
        }
        if (!$bankAccount->glAccount) {
            throw new \Exception(__('Bank account must have a GL account assigned before posting zakat payment.'));
        }

        $expenseAccount = $this->ensureZakatExpenseAccount($companyId);
        $expenseCategory = $this->ensureZakatExpenseCategory($companyId, $expenseAccount);
        $paymentDate = $data['payment_date'] ?? now()->toDateString();

        return DB::transaction(function () use ($calculation, $data, $amount, $bankAccount, $expenseAccount, $expenseCategory, $paymentDate, $companyId) {
            $expense = Expense::create([
                'expense_date' => $paymentDate,
                'category_id' => $expenseCategory->id,
                'bank_account_id' => $bankAccount->id,
                'chart_of_account_id' => $expenseAccount->id,
                'amount' => $amount,
                'description' => __('Zakat payment for :number', ['number' => $calculation->calculation_number]),
                'reference_number' => $data['reference_number'] ?? $calculation->calculation_number,
                'status' => 'approved',
                'approved_by' => Auth::id(),
                'creator_id' => Auth::id(),
                'created_by' => $companyId,
            ]);

            $this->journalService->createExpenseEntryJournal($expense);
            $this->bankTransactionsService->createExpensePayment($expense);
            $expense->update(['status' => 'posted']);

            $journal = JournalEntry::where('reference_type', 'expense')
                ->where('reference_id', $expense->id)
                ->latest('id')
                ->first();
            $bankTransaction = BankTransaction::where('bank_account_id', $bankAccount->id)
                ->where('reference_number', $expense->expense_number)
                ->latest('id')
                ->first();

            $payment = ZakatPayment::create([
                'zakat_calculation_id' => $calculation->id,
                'expense_id' => $expense->id,
                'journal_entry_id' => $journal?->id,
                'bank_transaction_id' => $bankTransaction?->id,
                'bank_account_id' => $bankAccount->id,
                'payment_date' => $paymentDate,
                'amount' => $amount,
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => 'posted',
                'creator_id' => Auth::id(),
                'created_by' => $companyId,
            ]);

            $paid = (float) $calculation->payments()->sum('amount');
            $calculation->update([
                'paid_amount' => $paid,
                'remaining_amount' => max(0, (float) $calculation->zakat_due - $paid),
            ]);

            return $payment;
        });
    }

    public function reportData(ZakatCalculation $calculation): array
    {
        $calculation->load(['lines', 'adjustments', 'payments.bankAccount', 'payments.expense']);

        return [
            'calculation' => $calculation,
            'lines' => $calculation->lines->groupBy('direction'),
            'payments' => $calculation->payments,
            'guidance' => $this->guidance(),
            'formula' => __('Cash and bank + trade inventory + collectible receivables + additions - due liabilities - deductions = zakatable base.'),
        ];
    }

    public function guidance(): array
    {
        return [
            [
                'title' => 'What enters zakat',
                'body' => 'Cash, bank balances, trade inventory prepared for sale, and collectible customer debts are included.',
            ],
            [
                'title' => 'What does not enter zakat',
                'body' => 'Equipment, vehicles, furniture, POS devices, shelves, and fixed assets not held for sale are excluded.',
            ],
            [
                'title' => 'What is deducted',
                'body' => 'Confirmed supplier credit and other due business debts are deducted. Long-term debt is not fully deducted automatically.',
            ],
            [
                'title' => 'Capital changes',
                'body' => 'Capital is not counted as a separate line. Whatever remains on zakat day as cash, receivable, or inventory is counted; withdrawn capital is outside the base.',
            ],
            [
                'title' => 'Important note',
                'body' => 'This module helps with accounting and documentation. It is not a fatwa; review the policy with your accountant or imam when needed.',
            ],
        ];
    }

    private function payloadFromInput(array $data, ZakatSetting $settings): array
    {
        $calculationDate = $data['calculation_date'] ?? now()->toDateString();
        $haulStartDate = $data['haul_start_date'] ?? optional($settings->haul_start_date)->toDateString() ?? now()->subDays(354)->toDateString();

        return [
            'calculation_date' => Carbon::parse($calculationDate)->toDateString(),
            'haul_start_date' => Carbon::parse($haulStartDate)->toDateString(),
            'nisab_amount' => $this->money($data['nisab_amount'] ?? $settings->nisab_amount),
            'rate_percent' => $this->money($data['rate_percent'] ?? $settings->rate_percent),
            'inventory_valuation_method' => $data['inventory_valuation_method'] ?? $settings->inventory_valuation_method,
            'liability_due_within_days' => (int) ($data['liability_due_within_days'] ?? $settings->liability_due_within_days),
            'receivable_policy' => $data['receivable_policy'] ?? $settings->receivable_policy,
            'adjustments' => $this->cleanAdjustments($data['adjustments'] ?? []),
        ];
    }

    private function buildLines(array $payload, int $companyId): array
    {
        return array_values(array_merge(
            $this->cashLines($companyId),
            $this->inventoryLines($payload, $companyId),
            $this->receivableLines($payload, $companyId),
            $this->liabilityLines($payload, $companyId),
            $this->adjustmentLines($payload['adjustments'] ?? [])
        ));
    }

    private function summarizeLines(array $lines, array $payload): array
    {
        $summary = [
            'cash_amount' => 0,
            'inventory_amount' => 0,
            'receivable_amount' => 0,
            'deductible_liabilities_amount' => 0,
            'manual_additions_amount' => 0,
            'manual_deductions_amount' => 0,
        ];

        foreach ($lines as $line) {
            if (!$line['is_included']) {
                continue;
            }

            $amount = (float) $line['amount'];
            match ($line['line_type']) {
                'cash' => $summary['cash_amount'] += $amount,
                'inventory' => $summary['inventory_amount'] += $amount,
                'receivable' => $summary['receivable_amount'] += $amount,
                'liability', 'bank_overdraft' => $summary['deductible_liabilities_amount'] += $amount,
                'manual_addition' => $summary['manual_additions_amount'] += $amount,
                'manual_deduction' => $summary['manual_deductions_amount'] += $amount,
                default => null,
            };
        }

        $zakatable = $summary['cash_amount']
            + $summary['inventory_amount']
            + $summary['receivable_amount']
            + $summary['manual_additions_amount']
            - $summary['deductible_liabilities_amount']
            - $summary['manual_deductions_amount'];

        $zakatable = max(0, $this->money($zakatable));
        $isNisabMet = $payload['nisab_amount'] > 0 && $zakatable >= (float) $payload['nisab_amount'];
        $isHaulMet = Carbon::parse($payload['haul_start_date'])->lte(Carbon::parse($payload['calculation_date'])->subDays(354));
        $zakatDue = ($isNisabMet && $isHaulMet) ? $this->money($zakatable * ((float) $payload['rate_percent'] / 100)) : 0;

        return array_merge($summary, [
            'zakatable_amount' => $zakatable,
            'zakat_due' => $zakatDue,
            'is_nisab_met' => $isNisabMet,
            'is_haul_met' => $isHaulMet,
        ]);
    }

    private function cashLines(int $companyId): array
    {
        if (!Schema::hasTable('bank_accounts')) {
            return [];
        }

        return BankAccount::where('created_by', $companyId)
            ->where('is_active', true)
            ->get()
            ->flatMap(function (BankAccount $account) {
                $balance = (float) $account->current_balance;
                if (abs($balance) < 0.01) {
                    return [];
                }

                if ($balance > 0) {
                    return [[
                        'line_type' => 'cash',
                        'source_table' => 'bank_accounts',
                        'source_id' => $account->id,
                        'title' => $account->account_name,
                        'description' => $account->bank_name,
                        'explanation' => __('Positive bank and cash balances are zakatable assets.'),
                        'quantity' => null,
                        'unit_value' => null,
                        'amount' => $this->money($balance),
                        'direction' => 'asset',
                        'is_included' => true,
                        'metadata' => ['account_number' => $account->account_number],
                    ]];
                }

                return [[
                    'line_type' => 'bank_overdraft',
                    'source_table' => 'bank_accounts',
                    'source_id' => $account->id,
                    'title' => $account->account_name,
                    'description' => $account->bank_name,
                    'explanation' => __('Negative bank balances are treated as currently due liabilities.'),
                    'quantity' => null,
                    'unit_value' => null,
                    'amount' => $this->money(abs($balance)),
                    'direction' => 'deduction',
                    'is_included' => true,
                    'metadata' => ['account_number' => $account->account_number],
                ]];
            })
            ->values()
            ->all();
    }

    private function inventoryLines(array $payload, int $companyId): array
    {
        if (!Schema::hasTable('warehouse_stocks') || !Schema::hasTable('product_service_items')) {
            return [];
        }

        $method = $payload['inventory_valuation_method'] === 'purchase_price' ? 'purchase_price' : 'sale_price';

        return WarehouseStock::with(['product', 'warehouse'])
            ->where('quantity', '>', 0)
            ->whereHas('warehouse', fn ($query) => $query->where('created_by', $companyId))
            ->get()
            ->map(function (WarehouseStock $stock) use ($method) {
                $product = $stock->product;
                if (!$product || !$product->is_active) {
                    return null;
                }

                $quantity = (float) $stock->quantity;
                $unitValue = (float) ($product->{$method} ?? 0);
                if ($unitValue <= 0 && $method === 'sale_price') {
                    $unitValue = (float) ($product->purchase_price ?? 0);
                }

                $amount = $this->money($quantity * $unitValue);
                if ($amount <= 0) {
                    return null;
                }

                return [
                    'line_type' => 'inventory',
                    'source_table' => 'warehouse_stocks',
                    'source_id' => $stock->id,
                    'title' => $product->name,
                    'description' => trim(($stock->warehouse?->name ?? '').' '.$product->sku),
                    'explanation' => __('Trade inventory prepared for sale is included at the configured valuation price.'),
                    'quantity' => $quantity,
                    'unit_value' => $unitValue,
                    'amount' => $amount,
                    'direction' => 'asset',
                    'is_included' => true,
                    'metadata' => ['valuation_method' => $method],
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function receivableLines(array $payload, int $companyId): array
    {
        if (!Schema::hasTable('sales_invoices')) {
            return [];
        }

        if ($payload['receivable_policy'] === 'paid_only') {
            return [];
        }

        $statuses = $payload['receivable_policy'] === 'all'
            ? ['draft', 'posted', 'partial', 'overdue']
            : ['posted', 'partial', 'overdue'];

        return SalesInvoice::with('customer:id,name,email')
            ->where('created_by', $companyId)
            ->whereIn('status', $statuses)
            ->where('balance_amount', '>', 0)
            ->whereDate('invoice_date', '<=', $payload['calculation_date'])
            ->get()
            ->map(function (SalesInvoice $invoice) {
                return [
                    'line_type' => 'receivable',
                    'source_table' => 'sales_invoices',
                    'source_id' => $invoice->id,
                    'title' => $invoice->invoice_number,
                    'description' => $invoice->customer?->name,
                    'explanation' => __('Collectible customer debts are included because they are business money owed to the company.'),
                    'quantity' => null,
                    'unit_value' => null,
                    'amount' => $this->money($invoice->balance_amount),
                    'direction' => 'asset',
                    'is_included' => true,
                    'metadata' => ['due_date' => optional($invoice->due_date)->toDateString(), 'status' => $invoice->status],
                ];
            })
            ->values()
            ->all();
    }

    private function liabilityLines(array $payload, int $companyId): array
    {
        if (!Schema::hasTable('purchase_invoices')) {
            return [];
        }

        $cutoff = Carbon::parse($payload['calculation_date'])
            ->addDays((int) $payload['liability_due_within_days'])
            ->toDateString();

        return PurchaseInvoice::with('vendor:id,name,email')
            ->where('created_by', $companyId)
            ->whereIn('status', ['posted', 'partial', 'overdue'])
            ->where('balance_amount', '>', 0)
            ->whereDate('invoice_date', '<=', $payload['calculation_date'])
            ->whereDate('due_date', '<=', $cutoff)
            ->get()
            ->map(function (PurchaseInvoice $invoice) {
                return [
                    'line_type' => 'liability',
                    'source_table' => 'purchase_invoices',
                    'source_id' => $invoice->id,
                    'title' => $invoice->invoice_number,
                    'description' => $invoice->vendor?->name,
                    'explanation' => __('Due supplier credit is deducted from zakatable assets.'),
                    'quantity' => null,
                    'unit_value' => null,
                    'amount' => $this->money($invoice->balance_amount),
                    'direction' => 'deduction',
                    'is_included' => true,
                    'metadata' => ['due_date' => optional($invoice->due_date)->toDateString(), 'status' => $invoice->status],
                ];
            })
            ->values()
            ->all();
    }

    private function adjustmentLines(array $adjustments): array
    {
        return collect($adjustments)->map(function (array $adjustment) {
            $type = $adjustment['adjustment_type'];

            return [
                'line_type' => $type === 'addition' ? 'manual_addition' : ($type === 'deduction' ? 'manual_deduction' : 'manual_exclusion'),
                'source_table' => 'zakat_adjustments',
                'source_id' => null,
                'title' => $adjustment['title'],
                'description' => $adjustment['reason'],
                'explanation' => $type === 'addition'
                    ? __('Manual addition: included because the user marked it as zakatable business value.')
                    : ($type === 'deduction'
                        ? __('Manual deduction: deducted because the user documented it as a confirmed liability or exclusion.')
                        : __('Manual exclusion: shown for transparency and not included in the calculation.')),
                'quantity' => null,
                'unit_value' => null,
                'amount' => $adjustment['amount'],
                'direction' => $type === 'addition' ? 'addition' : ($type === 'deduction' ? 'deduction' : 'exclusion'),
                'is_included' => $type !== 'exclusion',
                'metadata' => ['reason' => $adjustment['reason']],
            ];
        })->values()->all();
    }

    private function cleanAdjustments(array $adjustments): array
    {
        return collect($adjustments)
            ->filter(fn ($adjustment) => is_array($adjustment))
            ->map(function (array $adjustment) {
                return [
                    'adjustment_type' => in_array($adjustment['adjustment_type'] ?? '', ['addition', 'deduction', 'exclusion'], true)
                        ? $adjustment['adjustment_type']
                        : 'addition',
                    'title' => trim((string) ($adjustment['title'] ?? '')),
                    'amount' => $this->money($adjustment['amount'] ?? 0),
                    'reason' => trim((string) ($adjustment['reason'] ?? '')),
                ];
            })
            ->filter(fn ($adjustment) => $adjustment['title'] !== '' && $adjustment['amount'] > 0 && $adjustment['reason'] !== '')
            ->values()
            ->all();
    }

    private function ensureZakatExpenseAccount(int $companyId): ChartOfAccount
    {
        $account = ChartOfAccount::where('account_code', '5900')->where('created_by', $companyId)->first();
        if ($account) {
            return $account;
        }

        $category = AccountCategory::firstOrCreate(
            ['code' => 'EXP', 'created_by' => $companyId],
            [
                'name' => 'Expenses',
                'type' => 'expenses',
                'description' => 'Costs incurred in business operations',
                'is_active' => true,
                'creator_id' => $companyId,
            ]
        );

        $type = AccountType::firstOrCreate(
            ['code' => 'OX', 'created_by' => $companyId],
            [
                'category_id' => $category->id,
                'name' => 'Other Expenses',
                'normal_balance' => 'debit',
                'description' => 'Other miscellaneous expenses',
                'is_active' => true,
                'is_system_type' => true,
                'creator_id' => $companyId,
            ]
        );

        return ChartOfAccount::create([
            'account_code' => '5900',
            'account_name' => 'Zakat Expense',
            'account_type_id' => $type->id,
            'level' => 1,
            'normal_balance' => 'debit',
            'opening_balance' => 0,
            'current_balance' => 0,
            'is_active' => true,
            'is_system_account' => true,
            'description' => 'Zakat payments recorded from the Zakat module.',
            'creator_id' => $companyId,
            'created_by' => $companyId,
        ]);
    }

    private function ensureZakatExpenseCategory(int $companyId, ChartOfAccount $account): ExpenseCategories
    {
        return ExpenseCategories::firstOrCreate(
            ['category_code' => 'ZAK', 'created_by' => $companyId],
            [
                'category_name' => 'Zakat',
                'description' => 'Zakat payments',
                'is_active' => true,
                'gl_account_id' => $account->id,
                'creator_id' => $companyId,
            ]
        );
    }

    private function money($value): float
    {
        return round((float) ($value ?: 0), 2);
    }
}
