import { FormEvent, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Banknote, Boxes, Calculator, CircleDollarSign, FileText, HandCoins, Info, ListChecks, Plus, ShieldCheck, Trash2 } from 'lucide-react';
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
    const { settings, preview, calculations, guidance } = usePage<Props>().props;
    const summary = preview.summary || {};
    const zakatableAmount = Number(summary.zakatable_amount || 0);
    const zakatDue = Number(summary.zakat_due || 0);
    const nisabAmount = Number(preview.payload?.nisab_amount || 0);
    const isReady = Boolean(summary.is_nisab_met && summary.is_haul_met);

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

    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

    const updateSettings = (event: FormEvent) => {
        event.preventDefault();
        router.put(route('zakat.settings.update'), {
            ...settingsForm,
            show_guidance: settingsForm.show_guidance ? 1 : 0,
        }, { preserveScroll: true });
    };

    const createCalculation = (event: FormEvent) => {
        event.preventDefault();
        router.post(route('zakat.calculations.store'), {
            ...calculationForm,
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

    const SummaryCard = ({ title, value, help, icon: Icon, tone }: { title: string; value: any; help: string; icon: any; tone: string }) => (
        <Card className="overflow-hidden border-border/70 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted">
                                <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{help}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatCurrency(value || 0)}</p>
            </CardContent>
        </Card>
    );

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Zakat') }]}
            pageTitle={t('Zakat')}
        >
            <Head title={t('Zakat')} />

            <div className="mx-auto max-w-7xl space-y-6">
                <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-sm">
                    <div className="grid gap-6 p-5 lg:grid-cols-[1.25fr_0.75fr] lg:p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                                <Calculator className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-2xl font-semibold tracking-tight">{t('Zakat')}</h2>
                                    <Badge variant={isReady ? 'default' : 'secondary'}>
                                        {isReady ? t('Ready for zakat') : t('Needs review')}
                                    </Badge>
                                </div>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                    {t('Review the zakatable base, confirm nisab and haul, then create a fixed calculation snapshot with explanations and a downloadable report.')}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 rounded-xl border bg-white/80 p-3 backdrop-blur">
                            <div>
                                <p className="text-xs text-muted-foreground">{t('Base')}</p>
                                <p className="mt-1 text-sm font-semibold tabular-nums">{formatCurrency(zakatableAmount)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t('Nisab')}</p>
                                <p className="mt-1 text-sm font-semibold tabular-nums">{formatCurrency(nisabAmount)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{t('Due')}</p>
                                <p className="mt-1 text-sm font-semibold tabular-nums">{formatCurrency(zakatDue)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                    <SummaryCard title={t('Cash and Bank')} value={summary.cash_amount} help={t('Positive active bank balances are included as zakatable cash.')} icon={Banknote} tone="bg-emerald-50 text-emerald-700" />
                    <SummaryCard title={t('Trade Inventory')} value={summary.inventory_amount} help={t('Inventory prepared for sale is valued using the selected sale or purchase price policy.')} icon={Boxes} tone="bg-sky-50 text-sky-700" />
                    <SummaryCard title={t('Customer Debts')} value={summary.receivable_amount} help={t('Collectible posted customer invoice balances are included.')} icon={CircleDollarSign} tone="bg-indigo-50 text-indigo-700" />
                    <SummaryCard title={t('Deductible Credit')} value={summary.deductible_liabilities_amount} help={t('Supplier credit due within the selected liability window is deducted.')} icon={HandCoins} tone="bg-amber-50 text-amber-700" />
                </div>

                <Card className="overflow-hidden border-border/70 shadow-sm">
                    <CardHeader className="pb-3">
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
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Zakatable Base')}</p>
                                <p className="text-xl font-semibold tabular-nums">{formatCurrency(summary.zakatable_amount || 0)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Nisab')}</p>
                                <p className="text-xl font-semibold tabular-nums">{formatCurrency(preview.payload?.nisab_amount || 0)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Eligibility')}</p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Badge variant={summary.is_nisab_met ? 'default' : 'secondary'}>{summary.is_nisab_met ? t('Nisab Met') : t('Below Nisab')}</Badge>
                                    <Badge variant={summary.is_haul_met ? 'default' : 'secondary'}>{summary.is_haul_met ? t('Haul Met') : t('Haul Not Met')}</Badge>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Zakat Due')}</p>
                                <p className="text-xl font-semibold tabular-nums">{formatCurrency(summary.zakat_due || 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {settings.show_guidance && (
                    <Card className="overflow-hidden border-border/70 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">{t('Instructions and Explanations')}</CardTitle>
                                    <CardDescription>{t('Clear accounting guidance for what enters, what stays out, and what can be deducted.')}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[360px] rounded-lg border bg-muted/10 p-1 md:h-auto">
                                <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-2">
                                    {guidance.map((item) => (
                                        <div key={item.title} className="rounded-lg border bg-white p-4">
                                            <h3 className="font-semibold">{t(item.title)}</h3>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(item.body)}</p>
                                        </div>
                                    ))}
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 md:col-span-2">
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
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Zakat Settings')}</CardTitle>
                            <CardDescription>{t('Set the default nisab, haul, valuation method, and deduction policy for future calculations.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={updateSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>{t('Nisab Amount')}</Label>
                                    <Input type="number" step="0.01" value={settingsForm.nisab_amount} onChange={(event) => setSettingsForm({ ...settingsForm, nisab_amount: event.target.value })} />
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
                                    <select className="w-full h-10 rounded-md border px-3 text-sm" value={settingsForm.inventory_valuation_method} onChange={(event) => setSettingsForm({ ...settingsForm, inventory_valuation_method: event.target.value })}>
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
                                    <select className="w-full h-10 rounded-md border px-3 text-sm" value={settingsForm.receivable_policy} onChange={(event) => setSettingsForm({ ...settingsForm, receivable_policy: event.target.value })}>
                                        <option value="collectible">{t('Collectible Receivables')}</option>
                                        <option value="all">{t('All Receivables')}</option>
                                        <option value="paid_only">{t('Paid Only')}</option>
                                    </select>
                                </div>
                                <label className="md:col-span-2 flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={settingsForm.show_guidance} onChange={(event) => setSettingsForm({ ...settingsForm, show_guidance: event.target.checked })} />
                                    {t('Show guidance and explanations')}
                                </label>
                                <div className="md:col-span-2">
                                    <Button type="submit">{t('Save Settings')}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Create Zakat Calculation')}</CardTitle>
                            <CardDescription>{t('Create a dated snapshot after reviewing the current assets, credit, and manual adjustments.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createCalculation} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>{t('Calculation Date')}</Label>
                                        <Input type="date" value={calculationForm.calculation_date} onChange={(event) => setCalculationForm({ ...calculationForm, calculation_date: event.target.value })} />
                                    </div>
                                    <div>
                                        <Label>{t('Haul Start Date')}</Label>
                                        <Input type="date" value={calculationForm.haul_start_date} onChange={(event) => setCalculationForm({ ...calculationForm, haul_start_date: event.target.value })} />
                                    </div>
                                    <div>
                                        <Label>{t('Nisab Amount')}</Label>
                                        <Input type="number" step="0.01" value={calculationForm.nisab_amount} onChange={(event) => setCalculationForm({ ...calculationForm, nisab_amount: event.target.value })} />
                                    </div>
                                    <div>
                                        <Label>{t('Zakat Rate')}</Label>
                                        <Input type="number" step="0.01" value={calculationForm.rate_percent} onChange={(event) => setCalculationForm({ ...calculationForm, rate_percent: event.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <Label>{t('Notes')}</Label>
                                    <Textarea value={calculationForm.notes} onChange={(event) => setCalculationForm({ ...calculationForm, notes: event.target.value })} placeholder={t('Optional review notes')} />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>{t('Manual Adjustments')}</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addAdjustment}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            {t('Add Adjustment')}
                                        </Button>
                                    </div>
                                    <ScrollArea className={adjustments.length > 2 ? 'h-[250px] rounded-lg border' : ''}>
                                        <div className={adjustments.length > 2 ? 'space-y-3 p-3' : 'space-y-3'}>
                                            {adjustments.map((adjustment, index) => (
                                                <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/10 p-3 md:grid-cols-12">
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
                                    <Calculator className="h-4 w-4 mr-2" />
                                    {t('Create Calculation')}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <Card className="overflow-hidden border-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl">{t('Recent Zakat Calculations')}</CardTitle>
                        <CardDescription>{t('A scrollable audit list of created zakat snapshots and reports.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="max-h-[360px]">
                            <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px] text-sm">
                            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                                <tr>
                                    <th className="text-left p-3">{t('Number')}</th>
                                    <th className="text-left p-3">{t('Date')}</th>
                                    <th className="text-right p-3">{t('Zakatable Base')}</th>
                                    <th className="text-right p-3">{t('Zakat Due')}</th>
                                    <th className="text-right p-3">{t('Remaining')}</th>
                                    <th className="text-left p-3">{t('Status')}</th>
                                    <th className="text-right p-3">{t('Actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {calculations.length > 0 ? calculations.map((calculation) => (
                                    <tr key={calculation.id} className="border-t">
                                        <td className="p-3 font-medium">{calculation.calculation_number}</td>
                                        <td className="p-3">{formatDate(calculation.calculation_date)}</td>
                                        <td className="p-3 text-right tabular-nums">{formatCurrency(calculation.zakatable_amount)}</td>
                                        <td className="p-3 text-right tabular-nums">{formatCurrency(calculation.zakat_due)}</td>
                                        <td className="p-3 text-right tabular-nums">{formatCurrency(calculation.remaining_amount)}</td>
                                        <td className="p-3">
                                            <Badge variant={calculation.status === 'finalized' ? 'default' : 'secondary'}>{t(calculation.status)}</Badge>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={route('zakat.calculations.show', calculation.id)}>{t('View')}</Link>
                                                </Button>
                                                {calculation.status === 'finalized' && (
                                                    <Button variant="outline" size="sm" onClick={() => window.open(route('zakat.calculations.report', calculation.id) + '?download=pdf', '_blank')}>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        {t('Download Report')}
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td className="p-8 text-center text-muted-foreground" colSpan={7}>{t('No zakat calculations yet')}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
