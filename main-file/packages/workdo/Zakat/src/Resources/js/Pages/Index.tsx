import { FormEvent, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { KpiCard, KpiRow, EmptyState, ScrollX, Num } from '@/components/ui/page-kit';
import {
    Banknote, Boxes, Calculator, ChevronDown, CircleDollarSign, FileText, HandCoins,
    ListChecks, Plus, ShieldCheck, Trash2, TriangleAlert, ArrowLeft,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';

type ZakatSettings = {
    nisab_amount: string | number;
    rate_percent: string | number;
    haul_start_date?: string;
    inventory_valuation_method: 'sale_price' | 'purchase_price';
    liability_due_within_days: number;
    receivable_policy: string;
    show_guidance: boolean;
};

type Calculation = {
    id: number;
    calculation_number: string;
    calculation_date: string;
    zakatable_amount: string | number;
    zakat_due: string | number;
    paid_amount: string | number;
    remaining_amount: string | number;
    is_nisab_met: boolean;
    is_haul_met: boolean;
    status: string;
};

type Adjustment = {
    adjustment_type: 'addition' | 'deduction' | 'exclusion';
    title: string;
    amount: string;
    reason: string;
};

type Guidance = {
    title: string;
    body: string;
};

type Props = {
    settings: ZakatSettings;
    preview: {
        summary: Record<string, any>;
        payload: Record<string, any>;
    };
    calculations: Calculation[];
    guidance: Guidance[];
};

const today = new Date().toISOString().slice(0, 10);

export default function Index() {
    const { t } = useTranslation();
    const page = usePage<Props>();
    const { settings, preview, calculations, guidance } = page.props;
    const summary = preview.summary || {};

    // formatCurrency falls back to usePage() for company settings when it is
    // not given pageProps, so an unguarded call inside a conditional branch
    // changes this component's hook count between renders. Passing page.props
    // keeps the call hook-free and the order stable.
    const money = (value: unknown) => formatCurrency(Number(value ?? 0), page.props);

    const zakatableAmount = Number(summary.zakatable_amount || 0);
    const zakatDue = Number(summary.zakat_due || 0);
    const nisabAmount = Number(preview.payload?.nisab_amount || 0);

    // A nisab of 0 is "not configured yet", which the service reports separately
    // from a base that genuinely falls below a configured threshold.
    const nisabConfigured = summary.is_nisab_configured ?? nisabAmount > 0;
    const isReady = Boolean(summary.is_nisab_met && summary.is_haul_met);

    const heroBadge: { variant: 'destructive' | 'default' | 'secondary'; label: string } = !nisabConfigured
        ? { variant: 'destructive', label: t('Nisab Not Set') }
        : isReady
            ? { variant: 'default', label: t('Ready for zakat') }
            : { variant: 'secondary', label: t('Needs review') };

    // Resolved as data so the badge is one stable element across all states.
    const nisabBadge: { variant: 'destructive' | 'default' | 'secondary'; label: string } = !nisabConfigured
        ? { variant: 'destructive', label: t('Nisab Not Set') }
        : summary.is_nisab_met
            ? { variant: 'default', label: t('Nisab Met') }
            : { variant: 'secondary', label: t('Below Nisab') };

    const nisabFieldRef = useRef<HTMLInputElement>(null);

    const focusNisab = () => {
        nisabFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nisabFieldRef.current?.focus();
    };

    const [settingsForm, setSettingsForm] = useState({
        nisab_amount: String(settings.nisab_amount ?? 0),
        rate_percent: String(settings.rate_percent ?? 2.5),
        haul_start_date: settings.haul_start_date || '',
        inventory_valuation_method: settings.inventory_valuation_method || 'sale_price',
        liability_due_within_days: String(settings.liability_due_within_days ?? 354),
        receivable_policy: settings.receivable_policy || 'collectible',
        show_guidance: Boolean(settings.show_guidance),
    });

    const [calculationForm, setCalculationForm] = useState({
        calculation_date: today,
        haul_start_date: settings.haul_start_date || '',
        nisab_amount: String(settings.nisab_amount ?? 0),
        rate_percent: String(settings.rate_percent ?? 2.5),
        inventory_valuation_method: settings.inventory_valuation_method || 'sale_price',
        liability_due_within_days: String(settings.liability_due_within_days ?? 354),
        receivable_policy: settings.receivable_policy || 'collectible',
        notes: '',
    });

    // Off by default: the calculation inherits the saved settings shown above it.
    const [overrideSettings, setOverrideSettings] = useState(false);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [guidanceOpen, setGuidanceOpen] = useState(false);

    const updateSettings = (event: FormEvent) => {
        event.preventDefault();
        router.put(route('zakat.settings.update'), {
            ...settingsForm,
            show_guidance: settingsForm.show_guidance ? 1 : 0,
        }, { preserveScroll: true });
    };

    const createCalculation = (event: FormEvent) => {
        event.preventDefault();
        // When not overriding, submit the saved settings so the payload shape -
        // and the backend's per-snapshot override support - stays unchanged.
        const overrides = overrideSettings ? {
            haul_start_date: calculationForm.haul_start_date,
            nisab_amount: calculationForm.nisab_amount,
            rate_percent: calculationForm.rate_percent,
        } : {
            haul_start_date: settingsForm.haul_start_date,
            nisab_amount: settingsForm.nisab_amount,
            rate_percent: settingsForm.rate_percent,
        };

        router.post(route('zakat.calculations.store'), {
            ...calculationForm,
            ...overrides,
            adjustments,
        });
    };

    const addAdjustment = () => {
        setAdjustments([...adjustments, { adjustment_type: 'deduction', title: '', amount: '', reason: '' }]);
    };

    const updateAdjustment = (index: number, field: keyof Adjustment, value: string) => {
        setAdjustments(adjustments.map((adjustment, currentIndex) => currentIndex === index ? { ...adjustment, [field]: value } : adjustment));
    };

    const removeAdjustment = (index: number) => {
        setAdjustments(adjustments.filter((_, currentIndex) => currentIndex !== index));
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Zakat') }]}
            pageTitle={t('Zakat')}
        >
            <Head title={t('Zakat')} />

            <div className="mx-auto max-w-7xl space-y-6">
                {/* Hero: status and the single next action, no figures - those
                    live in the result card so each number appears once. */}
                <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 via-white to-sky-50 dark:from-emerald-500/10 dark:via-card dark:to-sky-500/10">
                    <div className="flex flex-wrap items-start gap-4 p-5 lg:p-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                            <Calculator className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('Zakat')}</h2>
                                <Badge variant={heroBadge.variant}>{heroBadge.label}</Badge>
                            </div>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                {t('Review the zakatable base, confirm nisab and haul, then create a fixed calculation snapshot with explanations and a downloadable report.')}
                            </p>

                            {/* The one thing blocking a real calculation. Hidden rather
                                than unmounted so the element tree stays constant. */}
                            <div
                                className={`mt-4 flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 ${nisabConfigured ? 'hidden' : 'flex'}`}
                            >
                                <TriangleAlert className="h-4 w-4 shrink-0" />
                                <span className="text-sm">{t('Set a nisab value to enable the zakat calculation.')}</span>
                                <Button type="button" size="sm" variant="outline" onClick={focusNisab}>
                                    {t('Set nisab')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Asset breakdown. */}
                <KpiRow cols={4}>
                    <KpiCard
                        label={t('Cash and Bank')}
                        value={money(summary.cash_amount)}
                        icon={<Banknote className="h-5 w-5" />}
                        tone="green"
                        hint={t('Positive active bank balances are included as zakatable cash.')}
                    />
                    <KpiCard
                        label={t('Trade Inventory')}
                        value={money(summary.inventory_amount)}
                        icon={<Boxes className="h-5 w-5" />}
                        tone="blue"
                        hint={t('Inventory prepared for sale is valued using the selected sale or purchase price policy.')}
                    />
                    <KpiCard
                        label={t('Customer Debts')}
                        value={money(summary.receivable_amount)}
                        icon={<CircleDollarSign className="h-5 w-5" />}
                        tone="blue"
                        hint={t('Collectible posted customer invoice balances are included.')}
                    />
                    <KpiCard
                        label={t('Deductible Credit')}
                        value={money(summary.deductible_liabilities_amount)}
                        icon={<HandCoins className="h-5 w-5" />}
                        tone="orange"
                        hint={t('Supplier credit due within the selected liability window is deducted.')}
                    />
                </KpiRow>

                {/* The single result surface: base -> due. */}
                <Card>
                    <CardHeader className="border-b">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-primary/10">
                                <Calculator className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">{t('Current Zakat Preview')}</CardTitle>
                                <CardDescription>
                                    {t('This preview uses today and the current settings. Create a calculation to save an auditable snapshot.')}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Zakatable Base')}</p>
                                <p className="text-2xl font-semibold tabular-nums">
                                    <Num>{money(zakatableAmount)}</Num>
                                </p>
                            </div>

                            <ArrowLeft className="hidden h-5 w-5 shrink-0 text-muted-foreground ltr:rotate-180 sm:block" />

                            <div>
                                <p className="text-sm text-muted-foreground">{t('Zakat Due')}</p>
                                <p className="text-2xl font-semibold tabular-nums text-primary">
                                    <Num>{money(zakatDue)}</Num>
                                </p>
                            </div>

                            <div className="ms-auto">
                                <p className="text-sm text-muted-foreground">{t('Eligibility')}</p>
                                {/* Keep the same element tree in every state - swapping
                                    props rather than mounting/unmounting avoids shifting
                                    sibling hook order when nisab becomes configured. */}
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Badge variant={nisabBadge.variant}>{nisabBadge.label}</Badge>
                                    <Badge variant={summary.is_haul_met ? 'default' : 'secondary'}>
                                        {summary.is_haul_met ? t('Haul Met') : t('Haul Not Met')}
                                    </Badge>
                                    <span className="self-center text-xs text-muted-foreground">
                                        {nisabConfigured ? <>{t('Nisab')}: <Num>{money(nisabAmount)}</Num></> : null}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Guidance: long-form reference, collapsed until asked for. */}
                {settings.show_guidance && (
                    <Collapsible open={guidanceOpen} onOpenChange={setGuidanceOpen}>
                        <Card>
                            <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-start">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-xl">{t('Instructions and Explanations')}</CardTitle>
                                    <CardDescription>
                                        {t('Clear accounting guidance for what enters, what stays out, and what can be deducted.')}
                                    </CardDescription>
                                </div>
                                <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                                    {guidanceOpen ? t('Hide guidance') : t('Show guidance')}
                                    <ChevronDown className={`h-4 w-4 transition-transform ${guidanceOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                                <CardContent className="border-t pt-4">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {guidance.map((item) => (
                                            <div key={item.title} className="rounded-lg border bg-muted/30 p-4">
                                                <h3 className="font-semibold text-foreground">{t(item.title)}</h3>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(item.body)}</p>
                                            </div>
                                        ))}
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 md:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                                            <div className="flex items-start gap-3">
                                                <ListChecks className="mt-0.5 h-5 w-5 shrink-0" />
                                                <div>
                                                    <h3 className="font-semibold">{t('Workflow')}</h3>
                                                    <p className="mt-1 text-sm leading-6">
                                                        {t('Enter nisab and haul, review zakatable assets, review credit deductions, add manual adjustments with reasons, finalize the calculation, then download the report or record payment.')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                )}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Zakat Settings')}</CardTitle>
                            <CardDescription>{t('Set the default nisab, haul, valuation method, and deduction policy for future calculations.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={updateSettings} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <Label>{t('Nisab Amount')}</Label>
                                    <Input
                                        ref={nisabFieldRef}
                                        type="number"
                                        step="0.01"
                                        value={settingsForm.nisab_amount}
                                        onChange={(event) => setSettingsForm({ ...settingsForm, nisab_amount: event.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>{t('Zakat Rate')}</Label>
                                    <Input type="number" step="0.01" value={settingsForm.rate_percent} onChange={(event) => setSettingsForm({ ...settingsForm, rate_percent: event.target.value })} />
                                </div>
                                <div>
                                    <Label>{t('Haul Start Date')}</Label>
                                    <Input type="date" value={settingsForm.haul_start_date} onChange={(event) => setSettingsForm({ ...settingsForm, haul_start_date: event.target.value })} />
                                </div>
                                <div>
                                    <Label>{t('Inventory Valuation')}</Label>
                                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={settingsForm.inventory_valuation_method} onChange={(event) => setSettingsForm({ ...settingsForm, inventory_valuation_method: event.target.value })}>
                                        <option value="sale_price">{t('Sale Price')}</option>
                                        <option value="purchase_price">{t('Purchase Price')}</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>{t('Credit Due Within Days')}</Label>
                                    <Input type="number" value={settingsForm.liability_due_within_days} onChange={(event) => setSettingsForm({ ...settingsForm, liability_due_within_days: event.target.value })} />
                                </div>
                                <div>
                                    <Label>{t('Customer Debt Policy')}</Label>
                                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={settingsForm.receivable_policy} onChange={(event) => setSettingsForm({ ...settingsForm, receivable_policy: event.target.value })}>
                                        <option value="collectible">{t('Collectible Receivables')}</option>
                                        <option value="all">{t('All Receivables')}</option>
                                        <option value="paid_only">{t('Paid Only')}</option>
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 text-sm md:col-span-2">
                                    <input type="checkbox" checked={settingsForm.show_guidance} onChange={(event) => setSettingsForm({ ...settingsForm, show_guidance: event.target.checked })} />
                                    {t('Show guidance and explanations')}
                                </label>
                                <div className="md:col-span-2">
                                    <Button type="submit">{t('Save Settings')}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Create Zakat Calculation')}</CardTitle>
                            <CardDescription>{t('Create a dated snapshot after reviewing the current assets, credit, and manual adjustments.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createCalculation} className="space-y-4">
                                <div>
                                    <Label>{t('Calculation Date')}</Label>
                                    <Input type="date" value={calculationForm.calculation_date} onChange={(event) => setCalculationForm({ ...calculationForm, calculation_date: event.target.value })} />
                                </div>

                                {/* Inherit from settings by default; reveal the fields only
                                    when the user explicitly wants a one-off override. */}
                                <div className="rounded-lg border bg-muted/30 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">{t('Override for this calculation')}</p>
                                            {!overrideSettings && (
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {t('Using saved settings')} — {t('Nisab')}{' '}
                                                    <Num>{money(settingsForm.nisab_amount)}</Num>
                                                    {' · '}{t('Zakat Rate')} <Num>{settingsForm.rate_percent}%</Num>
                                                    {settingsForm.haul_start_date && (
                                                        <>{' · '}{t('Haul from')} <Num>{formatDate(settingsForm.haul_start_date)}</Num></>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        <Switch checked={overrideSettings} onCheckedChange={setOverrideSettings} />
                                    </div>

                                    {overrideSettings && (
                                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <div>
                                                <Label>{t('Nisab Amount')}</Label>
                                                <Input type="number" step="0.01" value={calculationForm.nisab_amount} onChange={(event) => setCalculationForm({ ...calculationForm, nisab_amount: event.target.value })} />
                                            </div>
                                            <div>
                                                <Label>{t('Zakat Rate')}</Label>
                                                <Input type="number" step="0.01" value={calculationForm.rate_percent} onChange={(event) => setCalculationForm({ ...calculationForm, rate_percent: event.target.value })} />
                                            </div>
                                            <div>
                                                <Label>{t('Haul Start Date')}</Label>
                                                <Input type="date" value={calculationForm.haul_start_date} onChange={(event) => setCalculationForm({ ...calculationForm, haul_start_date: event.target.value })} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Label>{t('Notes')}</Label>
                                    <Textarea value={calculationForm.notes} onChange={(event) => setCalculationForm({ ...calculationForm, notes: event.target.value })} placeholder={t('Optional review notes')} />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>{t('Manual Adjustments')}</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addAdjustment}>
                                            <Plus className="h-4 w-4 me-2" />
                                            {t('Add Adjustment')}
                                        </Button>
                                    </div>
                                    <ScrollArea className={adjustments.length > 2 ? 'h-[250px] rounded-lg border' : ''}>
                                        <div className={adjustments.length > 2 ? 'space-y-3 p-3' : 'space-y-3'}>
                                            {adjustments.map((adjustment, index) => (
                                                <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-12">
                                                    <select className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2" value={adjustment.adjustment_type} onChange={(event) => updateAdjustment(index, 'adjustment_type', event.target.value)}>
                                                        <option value="addition">{t('Addition')}</option>
                                                        <option value="deduction">{t('Deduction')}</option>
                                                        <option value="exclusion">{t('Exclusion')}</option>
                                                    </select>
                                                    <Input className="md:col-span-3" value={adjustment.title} onChange={(event) => updateAdjustment(index, 'title', event.target.value)} placeholder={t('Title')} />
                                                    <Input className="md:col-span-2" type="number" step="0.01" value={adjustment.amount} onChange={(event) => updateAdjustment(index, 'amount', event.target.value)} placeholder={t('Amount')} />
                                                    <Input className="md:col-span-4" value={adjustment.reason} onChange={(event) => updateAdjustment(index, 'reason', event.target.value)} placeholder={t('Reason')} />
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAdjustment(index)} className="md:col-span-1">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>

                                <Button type="submit">
                                    <Calculator className="h-4 w-4 me-2" />
                                    {t('Create Calculation')}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-xl">{t('Recent Zakat Calculations')}</CardTitle>
                        <CardDescription>{t('A scrollable audit list of created zakat snapshots and reports.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {calculations.length === 0 ? (
                            <EmptyState
                                icon={<FileText className="h-10 w-10" />}
                                title={t('No zakat calculations yet')}
                                description={t('Create a dated snapshot after reviewing the current assets, credit, and manual adjustments.')}
                            />
                        ) : (
                            <ScrollArea className="max-h-[360px]">
                                <ScrollX>
                                    <table className="w-full min-w-[920px] text-sm">
                                        <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                                            <tr>
                                                <th className="p-3 text-start">{t('Number')}</th>
                                                <th className="p-3 text-start">{t('Date')}</th>
                                                <th className="p-3 text-end">{t('Zakatable Base')}</th>
                                                <th className="p-3 text-end">{t('Zakat Due')}</th>
                                                <th className="p-3 text-end">{t('Remaining')}</th>
                                                <th className="p-3 text-start">{t('Status')}</th>
                                                <th className="p-3 text-end">{t('Actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calculations.map((calculation) => (
                                                <tr key={calculation.id} className="border-t">
                                                    <td className="p-3 font-medium">{calculation.calculation_number}</td>
                                                    <td className="p-3"><Num>{formatDate(calculation.calculation_date)}</Num></td>
                                                    <td className="p-3 text-end tabular-nums"><Num>{money(calculation.zakatable_amount)}</Num></td>
                                                    <td className="p-3 text-end tabular-nums"><Num>{money(calculation.zakat_due)}</Num></td>
                                                    <td className="p-3 text-end tabular-nums"><Num>{money(calculation.remaining_amount)}</Num></td>
                                                    <td className="p-3">
                                                        <Badge variant={calculation.status === 'finalized' ? 'default' : 'secondary'}>{t(calculation.status)}</Badge>
                                                    </td>
                                                    <td className="p-3 text-end">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={route('zakat.calculations.show', calculation.id)}>{t('View')}</Link>
                                                            </Button>
                                                            {calculation.status === 'finalized' && (
                                                                <Button variant="outline" size="sm" onClick={() => window.open(route('zakat.calculations.report', calculation.id) + '?download=pdf', '_blank')}>
                                                                    <FileText className="h-4 w-4 me-2" />
                                                                    {t('Download Report')}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ScrollX>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
