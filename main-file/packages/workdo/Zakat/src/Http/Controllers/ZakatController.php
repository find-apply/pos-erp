<?php

namespace Workdo\Zakat\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Workdo\Account\Models\BankAccount;
use Workdo\Zakat\Models\ZakatCalculation;
use Workdo\Zakat\Services\ZakatCalculationService;

class ZakatController extends Controller
{
    public function __construct(private ZakatCalculationService $zakatService)
    {
    }

    public function index()
    {
        if (!Auth::user()->can('manage-zakat')) {
            return back()->with('error', __('Permission denied'));
        }

        $settings = $this->zakatService->getSettings();
        $preview = $this->zakatService->preview([
            'calculation_date' => now()->toDateString(),
        ]);

        $calculations = ZakatCalculation::where('created_by', creatorId())
            ->latest()
            ->take(20)
            ->get();

        $settingsPayload = $settings->toArray();
        $settingsPayload['haul_start_date'] = optional($settings->haul_start_date)->toDateString();

        return Inertia::render('Zakat/Index', [
            'settings' => $settingsPayload,
            'preview' => $preview,
            'calculations' => $calculations,
            'guidance' => $this->zakatService->guidance(),
            'abilities' => [
                'create' => Auth::user()->can('create-zakat-calculations'),
                'manageSettings' => Auth::user()->can('manage-zakat-settings'),
            ],
        ]);
    }

    /**
     * Recompute the preview for the values currently in the wizard.
     *
     * The wizard shows a running zakat figure on every step, and several inputs
     * (valuation method, receivable policy, liability window) change which rows
     * the service includes - so the numbers cannot be derived in the browser
     * without restating the whole formula there. This keeps one implementation.
     */
    public function previewCalculation(Request $request)
    {
        if (!Auth::user()->can('manage-zakat')) {
            abort(403);
        }

        $validated = $request->validate($this->calculationRules());

        return response()->json($this->zakatService->preview($validated));
    }

    public function updateSettings(Request $request)
    {
        if (!Auth::user()->can('manage-zakat-settings')) {
            return back()->with('error', __('Permission denied'));
        }

        $validated = $request->validate([
            'nisab_amount' => ['required', 'numeric', 'min:0'],
            'gold_price_per_gram' => ['nullable', 'numeric', 'min:0'],
            'rate_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'haul_start_date' => ['nullable', 'date'],
            'inventory_valuation_method' => ['required', 'in:sale_price,purchase_price'],
            'liability_due_within_days' => ['required', 'integer', 'min:0', 'max:3650'],
            'receivable_policy' => ['required', 'in:collectible,all,paid_only'],
            'show_guidance' => ['nullable', 'boolean'],
        ]);

        $this->zakatService->updateSettings($validated);

        return back()->with('success', __('Zakat settings updated successfully.'));
    }

    public function store(Request $request)
    {
        if (!Auth::user()->can('create-zakat-calculations')) {
            return back()->with('error', __('Permission denied'));
        }

        $validated = $request->validate($this->calculationRules() + [
            'notes' => ['nullable', 'string', 'max:5000'],
            'save_as_defaults' => ['nullable', 'boolean'],
            // Not calculation inputs - carried only so completing the wizard
            // can save them as defaults.
            'show_guidance' => ['nullable', 'boolean'],
        ]);

        // The wizard collects the same values the settings form used to, so
        // completing it can carry them forward instead of making the user
        // retype nisab and haul on the next run.
        if ($request->boolean('save_as_defaults') && Auth::user()->can('manage-zakat-settings')) {
            $this->zakatService->updateSettings($validated);
        }

        $calculation = $this->zakatService->createCalculation($validated);

        return redirect()
            ->route('zakat.calculations.show', $calculation->id)
            ->with('success', __('Zakat calculation created. Review it before finalizing.'));
    }

    public function show(ZakatCalculation $calculation)
    {
        if (!Auth::user()->can('view-zakat') && !Auth::user()->can('manage-zakat')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($calculation->created_by !== creatorId()) {
            return redirect()->route('zakat.index')->with('error', __('Permission denied'));
        }

        $calculation->load(['lines', 'adjustments', 'payments.bankAccount', 'payments.expense']);
        $bankAccounts = BankAccount::where('created_by', creatorId())
            ->where('is_active', true)
            ->select('id', 'account_name', 'bank_name', 'current_balance', 'gl_account_id')
            ->get();

        return Inertia::render('Zakat/Calculations/Show', [
            'calculation' => $calculation,
            'bankAccounts' => $bankAccounts,
            'guidance' => $this->zakatService->guidance(),
        ]);
    }

    public function finalize(ZakatCalculation $calculation)
    {
        if (!Auth::user()->can('finalize-zakat-calculations')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($calculation->created_by !== creatorId()) {
            return redirect()->route('zakat.index')->with('error', __('Permission denied'));
        }

        $this->zakatService->finalize($calculation);

        return back()->with('success', __('Zakat calculation finalized. You can now download the report or record payment.'));
    }

    public function report(ZakatCalculation $calculation)
    {
        if (!Auth::user()->can('print-zakat-reports')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($calculation->created_by !== creatorId()) {
            return redirect()->route('zakat.index')->with('error', __('Permission denied'));
        }

        return Inertia::render('Zakat/Report/Print', $this->zakatService->reportData($calculation));
    }

    public function storePayment(Request $request, ZakatCalculation $calculation)
    {
        if (!Auth::user()->can('record-zakat-payments')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($calculation->created_by !== creatorId()) {
            return redirect()->route('zakat.index')->with('error', __('Permission denied'));
        }

        $validated = $request->validate([
            'bank_account_id' => ['required', 'integer'],
            'payment_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $this->zakatService->recordPayment($calculation, $validated);
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', __('Zakat payment recorded successfully.'));
    }

    /** Inputs that define a zakat snapshot, shared by the preview and the save. */
    private function calculationRules(): array
    {
        return [
            'calculation_date' => ['required', 'date'],
            'haul_start_date' => ['nullable', 'date'],
            'nisab_amount' => ['required', 'numeric', 'min:0'],
            'gold_grams' => ['nullable', 'numeric', 'min:0'],
            'gold_price_per_gram' => ['nullable', 'numeric', 'min:0'],
            'rate_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'inventory_valuation_method' => ['required', 'in:sale_price,purchase_price'],
            'liability_due_within_days' => ['required', 'integer', 'min:0', 'max:3650'],
            'receivable_policy' => ['required', 'in:collectible,all,paid_only'],
            'adjustments' => ['nullable', 'array'],
            'adjustments.*.adjustment_type' => ['nullable', 'in:addition,deduction,exclusion'],
            'adjustments.*.title' => ['nullable', 'string', 'max:255'],
            'adjustments.*.amount' => ['nullable', 'numeric', 'min:0'],
            'adjustments.*.reason' => ['nullable', 'string', 'max:1000'],
            'overrides' => ['nullable', 'array'],
        ] + $this->overrideRules();
    }

    /**
     * One rule per overridable section, derived from the service's own list so
     * adding a section there cannot leave an unvalidated field here.
     */
    private function overrideRules(): array
    {
        $rules = [];

        foreach (ZakatCalculationService::OVERRIDABLE_SECTIONS as $section) {
            $rules["overrides.{$section}"] = ['nullable', 'numeric', 'min:0'];
        }

        return $rules;
    }
}
