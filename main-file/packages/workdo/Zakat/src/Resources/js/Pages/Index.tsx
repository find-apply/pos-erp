import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EmptyState, ScrollX, Num } from '@/components/ui/page-kit';
import {
    ArrowLeft, ArrowRight, Banknote, Boxes, Calculator, Check, ChevronDown,
    CircleDollarSign, FileText, Gem, HandCoins, Loader2, Plus, RotateCcw, Save,
    ShieldCheck, SlidersHorizontal, Trash2, TriangleAlert,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';

/** Sections the service will let a hand-entered figure replace. */
type Section = 'cash' | 'inventory' | 'receivable' | 'liability';

type ZakatSettings = {
    nisab_amount: string | number;
    gold_price_per_gram: string | number;
    rate_percent: string | number;
    haul_start_date?: string;
    inventory_valuation_method: 'sale_price' | 'purchase_price';
    liability_due_within_days: number;
    receivable_policy: string;
    show_guidance: boolean;
};

type Summary = {
    gold_amount?: string | number;
    cash_amount?: string | number;
    inventory_amount?: string | number;
    receivable_amount?: string | number;
    deductible_liabilities_amount?: string | number;
    manual_additions_amount?: string | number;
    manual_deductions_amount?: string | number;
    zakatable_amount?: string | number;
    zakat_due?: string | number;
    is_nisab_configured?: boolean;
    is_nisab_met?: boolean;
    is_haul_met?: boolean;
    haul_complete_date?: string;
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

type Guidance = { title: string; body: string };

type Props = {
    settings: ZakatSettings;
    preview: { summary: Summary; payload: Record<string, any> };
    calculations: Calculation[];
    guidance: Guidance[];
    abilities: { create: boolean; manageSettings: boolean };
};

const today = new Date().toISOString().slice(0, 10);

/** Amounts are entered and read in millions on the money step. */
const MILLION = 1_000_000;

/** The classic nisab: the value of 85 grams of gold. */
const NISAB_GOLD_GRAMS = 85;

/**
 * Accepts either decimal separator.
 *
 * The fields below are text rather than number inputs: a number input is
 * rendered by the browser's own locale, so 3.033984 was displayed as
 * "3,033984" and read as three million rather than three. Text keeps the
 * string exactly as written here, and this undoes a comma someone types.
 */
const toNumber = (text: string | number | null | undefined) =>
    Number(String(text ?? '').trim().replace(',', '.').replace(/\s/g, '')) || 0;

/** Digits and a single separator; anything else never reaches the field. */
const cleanDecimal = (text: string) => {
    const kept = text.replace(/[^\d.,]/g, '').replace(',', '.');
    const [whole, ...rest] = kept.split('.');

    return rest.length ? `${whole}.${rest.join('')}` : whole;
};

/** Trailing zeros stripped, so 2 980 000 reads as "2.98" and not "2.980000". */
const toMillions = (value: unknown) => {
    const millions = Number(value ?? 0) / MILLION;

    return Number.isFinite(millions) ? String(Number(millions.toFixed(6))) : '0';
};

/** Rounded to the currency's own precision, not the float's. */
const fromMillions = (text: string) => Math.round(toNumber(text) * MILLION * 100) / 100;

/** The service drops any adjustment missing a title, an amount, or a reason. */
const isAdjustmentComplete = (adjustment: Adjustment) =>
    adjustment.title.trim() !== '' && toNumber(adjustment.amount) > 0 && adjustment.reason.trim() !== '';

export default function Index() {
    const { t } = useTranslation();
    const page = usePage<Props>();
    const { settings, preview, calculations, guidance, abilities } = page.props;

    // formatCurrency falls back to usePage() for company settings when it is
    // not given pageProps, so an unguarded call inside a conditional branch
    // changes this component's hook count between renders. Passing page.props
    // keeps the call hook-free and the order stable.
    const money = (value: unknown) => formatCurrency(Number(value ?? 0), page.props);

    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        calculation_date: today,
        haul_start_date: settings.haul_start_date || '',
        // From the resolved payload, not the raw setting: the service derives a
        // nisab from the gold price when none was ever entered by hand.
        nisab_amount: String(preview.payload?.nisab_amount ?? settings.nisab_amount ?? 0),
        gold_price_per_gram: String(settings.gold_price_per_gram ?? 0),
        // Grams, not a value: the weight is what an owner knows, and the price
        // it is worth moves between one calculation and the next.
        gold_grams: '',
        rate_percent: String(settings.rate_percent ?? 2.5),
        inventory_valuation_method: settings.inventory_valuation_method || 'sale_price',
        liability_due_within_days: String(settings.liability_due_within_days ?? 354),
        receivable_policy: settings.receivable_policy || 'collectible',
        show_guidance: Boolean(settings.show_guidance),
        notes: '',
    });
    // Keyed by section and held in millions, exactly as typed. A section absent
    // here is read from the books; an empty string is not the same as a zero.
    const [overrides, setOverrides] = useState<Partial<Record<Section, string>>>({});
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [summary, setSummary] = useState<Summary>(preview.summary || {});
    const [refreshing, setRefreshing] = useState(false);
    const [saveDefaults, setSaveDefaults] = useState(true);
    const [saving, setSaving] = useState(false);
    const [guidanceOpen, setGuidanceOpen] = useState(false);
    // Always closed on arrival. Every field inside it has a working default, so
    // it is somewhere to go and correct a value, not a stop on the way through.
    const [conditionsOpen, setConditionsOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const conditionsRef = useRef<HTMLDivElement>(null);

    const set = (key: keyof typeof form, value: string | boolean) =>
        setForm((current) => ({ ...current, [key]: value }));

    // Only complete rows are worth sending; the rest are still being typed.
    const countedAdjustments = useMemo(() => adjustments.filter(isAdjustmentComplete), [adjustments]);

    const overridePayload = useMemo(() => {
        const result: Partial<Record<Section, number>> = {};

        (Object.keys(overrides) as Section[]).forEach((section) => {
            const typed = overrides[section];
            if (typed !== undefined && typed.trim() !== '' && Number.isFinite(toNumber(typed))) {
                result[section] = fromMillions(typed);
            }
        });

        return result;
    }, [overrides]);

    const payload = useMemo(() => ({
        calculation_date: form.calculation_date,
        haul_start_date: form.haul_start_date || null,
        nisab_amount: form.nisab_amount === '' ? 0 : form.nisab_amount,
        gold_grams: form.gold_grams === '' ? 0 : form.gold_grams,
        gold_price_per_gram: form.gold_price_per_gram === '' ? 0 : form.gold_price_per_gram,
        rate_percent: form.rate_percent === '' ? 0 : form.rate_percent,
        inventory_valuation_method: form.inventory_valuation_method,
        liability_due_within_days: form.liability_due_within_days === '' ? 0 : form.liability_due_within_days,
        receivable_policy: form.receivable_policy,
        adjustments: countedAdjustments,
        overrides: overridePayload,
    }), [form, countedAdjustments, overridePayload]);

    const payloadKey = JSON.stringify(payload);

    // The first render already has the server's preview for these exact values,
    // so the initial fetch would be a duplicate.
    const primed = useRef(false);
    // Responses can land out of order; only the newest one may set state.
    const requestId = useRef(0);

    useEffect(() => {
        if (!primed.current) {
            primed.current = true;
            return;
        }

        const timer = setTimeout(() => {
            const id = ++requestId.current;
            setRefreshing(true);

            axios.post(route('zakat.preview'), payload)
                .then((response) => {
                    if (id === requestId.current) setSummary(response.data.summary);
                })
                // Keep the last good figures rather than blanking the page; the
                // saved snapshot is recomputed server-side regardless.
                .catch(() => undefined)
                .finally(() => {
                    if (id === requestId.current) setRefreshing(false);
                });
        }, 400);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payloadKey]);

    const nisabConfigured = toNumber(form.nisab_amount) > 0;
    const zakatableAmount = Number(summary.zakatable_amount || 0);
    const zakatDue = Number(summary.zakat_due || 0);
    const isEligible = Boolean(summary.is_nisab_met && summary.is_haul_met);

    const steps = [
        { title: t('Your money'), icon: Banknote },
        { title: t('Adjustments'), icon: SlidersHorizontal },
        { title: t('Zakat due'), icon: Calculator },
    ];
    const descriptions = [
        t('Read from your books, in millions. Change any figure that does not match reality.'),
        t('Anything your books do not know about. Skip this if there is nothing.'),
        t('The amount due, and the snapshot you can save, print, and pay from.'),
    ];
    const lastStep = steps.length - 1;

    // Without a nisab there is no eligibility test to run, so the result would
    // be a zero with no explanation behind it.
    const blocked = step === 0 && !nisabConfigured;

    const openConditions = () => {
        setStep(0);
        setConditionsOpen(true);
        setTimeout(() => conditionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    };

    const addAdjustment = () =>
        setAdjustments((current) => [...current, { adjustment_type: 'deduction', title: '', amount: '', reason: '' }]);

    const updateAdjustment = (index: number, field: keyof Adjustment, value: string) =>
        setAdjustments((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

    const removeAdjustment = (index: number) =>
        setAdjustments((current) => current.filter((_, i) => i !== index));

    // The nisab is a gold value, so the price of a gram is the number a user is
    // far likelier to have to hand than the threshold itself. Editing it here
    // rewrites the nisab; editing the nisab directly leaves the price alone.
    const applyGoldPrice = (price: string) =>
        setForm((current) => ({
            ...current,
            gold_price_per_gram: price,
            nisab_amount: String(Math.round(toNumber(price) * NISAB_GOLD_GRAMS * 100) / 100),
        }));

    const save = () => {
        setSaving(true);
        router.post(route('zakat.calculations.store'), {
            ...payload,
            notes: form.notes,
            show_guidance: form.show_guidance ? 1 : 0,
            save_as_defaults: saveDefaults && abilities.manageSettings ? 1 : 0,
        }, { onFinish: () => setSaving(false) });
    };

    const rows: { section: Section; label: string; icon: typeof Banknote; hint: string; sign: string; amount: unknown }[] = [
        {
            section: 'cash', label: t('Cash and Bank'), icon: Banknote, sign: '+',
            hint: t('Positive active bank balances are included as zakatable cash.'),
            amount: summary.cash_amount,
        },
        {
            section: 'inventory', label: t('Trade Inventory'), icon: Boxes, sign: '+',
            hint: t('Inventory prepared for sale is valued using the selected sale or purchase price policy.'),
            amount: summary.inventory_amount,
        },
        {
            section: 'receivable', label: t('Customer Debts'), icon: CircleDollarSign, sign: '+',
            hint: t('Collectible posted customer invoice balances are included.'),
            amount: summary.receivable_amount,
        },
        {
            section: 'liability', label: t('Deductible Credit'), icon: HandCoins, sign: '−',
            hint: t('Supplier credit due within the selected liability window is deducted.'),
            amount: summary.deductible_liabilities_amount,
        },
    ];

    return (
        <AuthenticatedLayout breadcrumbs={[{ label: t('Zakat') }]} pageTitle={t('Zakat')}>
            <Head title={t('Zakat')} />

            <div className="mx-auto max-w-4xl space-y-6">
                {/* Progress. Visited steps stay clickable so corrections do not
                    mean walking the whole wizard again. */}
                <div className="rounded-xl border bg-card p-4">
                    {/* items-start, and the connector offset to the circle's
                        centre, so the row still lines up when the labels are
                        hidden on small screens. */}
                    <div className="flex items-start">
                        {steps.map((item, index) => {
                            const done = index < step;
                            const current = index === step;
                            const StepIcon = item.icon;

                            return (
                                <div key={item.title} className="flex min-w-0 flex-1 items-start last:flex-none">
                                    <button
                                        type="button"
                                        onClick={() => index <= step && setStep(index)}
                                        disabled={index > step}
                                        className="flex min-w-0 flex-col items-center gap-1.5 disabled:cursor-default"
                                    >
                                        <span
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                                current
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : done
                                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                                        : 'border-muted-foreground/30 text-muted-foreground'
                                            }`}
                                        >
                                            {done ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                                        </span>
                                        <span
                                            className={`hidden truncate text-xs sm:block ${
                                                current ? 'font-medium text-foreground' : 'text-muted-foreground'
                                            }`}
                                        >
                                            {item.title}
                                        </span>
                                    </button>
                                    {index < lastStep && (
                                        <span className={`mx-2 mt-[17px] h-0.5 flex-1 ${done ? 'bg-emerald-600' : 'bg-border'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Card>
                    <CardHeader className="border-b">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-xl">{steps[step].title}</CardTitle>
                                <CardDescription>{descriptions[step]}</CardDescription>
                            </div>

                            <div className={`text-end ${step < lastStep ? '' : 'hidden'}`}>
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    {t('Zakatable Base')}
                                    {refreshing && <Loader2 className="h-3 w-3 animate-spin" />}
                                </p>
                                <p className="text-lg font-semibold tabular-nums">
                                    <Num>{toMillions(zakatableAmount)}</Num>
                                    <span className="ms-1 text-xs font-normal text-muted-foreground">{t('million')}</span>
                                </p>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-5">
                        {/* 1. What the books hold, in millions and editable. */}
                        {step === 0 && (
                            <div className="space-y-4">
                                {/* Only reachable if someone clears the threshold by hand;
                                    a fresh company gets one derived from the gold price. */}
                                <div
                                    className={`items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 ${
                                        nisabConfigured ? 'hidden' : 'flex'
                                    }`}
                                >
                                    <TriangleAlert className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 flex-1">{t('Set a nisab value to enable the zakat calculation.')}</span>
                                    <Button type="button" size="sm" variant="outline" onClick={openConditions}>
                                        {t('Set nisab')}
                                    </Button>
                                </div>

                                <div className="divide-y rounded-lg border">
                                    {/* The one row entered by weight rather than value: the
                                        owner knows the grams, and the price that turns them
                                        into money lives in the conditions panel. */}
                                    <div className="flex flex-wrap items-start gap-3 p-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                            <Gem className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-[8rem] flex-1">
                                            <p className="text-sm font-medium">
                                                <span className="me-1 text-muted-foreground">+</span>
                                                {t('Gold you hold')}
                                            </p>
                                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                                {t('Enter the weight in grams.')}{' '}
                                                <Num>{money(form.gold_price_per_gram)}</Num> {t('per gram')}
                                            </p>
                                        </div>

                                        <div className="w-40 shrink-0">
                                            <div className="relative">
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={form.gold_grams}
                                                    onChange={(event) => set('gold_grams', cleanDecimal(event.target.value))}
                                                    placeholder="0"
                                                    className="pe-12 text-end tabular-nums"
                                                    aria-label={t('Gold you hold')}
                                                />
                                                <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground">
                                                    {t('gram')}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-end text-xs text-muted-foreground">
                                                = <Num>{money(summary.gold_amount)}</Num>
                                            </p>
                                        </div>
                                    </div>

                                    {rows.map((row) => {
                                        const RowIcon = row.icon;
                                        const overridden = overrides[row.section] !== undefined;
                                        const shown = overridden ? overrides[row.section]! : toMillions(row.amount);
                                        const exact = overridden ? fromMillions(shown) : Number(row.amount ?? 0);

                                        return (
                                            <div key={row.section} className="flex flex-wrap items-start gap-3 p-3">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                                    <RowIcon className="h-4 w-4" />
                                                </span>
                                                <div className="min-w-[8rem] flex-1">
                                                    <p className="text-sm font-medium">
                                                        <span className="me-1 text-muted-foreground">{row.sign}</span>
                                                        {row.label}
                                                    </p>
                                                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{row.hint}</p>
                                                </div>

                                                <div className="w-40 shrink-0">
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={shown}
                                                            onChange={(event) =>
                                                                setOverrides((current) => ({
                                                                    ...current,
                                                                    [row.section]: cleanDecimal(event.target.value),
                                                                }))
                                                            }
                                                            className="text-end tabular-nums"
                                                            aria-label={row.label}
                                                        />
                                                        {/* Dropping the key restores the book value; a zero
                                                            typed by hand is a different statement. */}
                                                        {overridden && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="shrink-0"
                                                                aria-label={t('Restore the value from the books')}
                                                                title={t('Restore the value from the books')}
                                                                onClick={() =>
                                                                    setOverrides((current) => {
                                                                        const next = { ...current };
                                                                        delete next[row.section];
                                                                        return next;
                                                                    })
                                                                }
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-end text-xs text-muted-foreground">
                                                        {t('million')} · <Num>{money(exact)}</Num>
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="flex items-center justify-between bg-muted/40 p-3">
                                        <p className="font-medium">{t('Zakatable Base')}</p>
                                        <p className="text-end">
                                            <span className="text-lg font-semibold tabular-nums">
                                                <Num>{toMillions(zakatableAmount)}</Num>
                                            </span>
                                            <span className="ms-1 text-xs text-muted-foreground">{t('million')}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                <Num>{money(zakatableAmount)}</Num>
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <Collapsible open={conditionsOpen} onOpenChange={setConditionsOpen}>
                                    <div ref={conditionsRef}>
                                        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${conditionsOpen ? 'rotate-180' : ''}`} />
                                            {t('Conditions and options')}
                                            <span className="hidden sm:inline">
                                                — {t('Nisab')} <Num>{money(form.nisab_amount)}</Num>
                                                {' · '}<Num>{form.rate_percent}%</Num>
                                            </span>
                                        </CollapsibleTrigger>
                                    </div>
                                    <CollapsibleContent>
                                        <div className="mt-2 space-y-4 rounded-lg border p-3">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                                <div>
                                                    <Label>{t('Nisab Amount')}</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={form.nisab_amount}
                                                        onChange={(event) => set('nisab_amount', cleanDecimal(event.target.value))}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>{t('Gold price per gram')}</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={form.gold_price_per_gram}
                                                        onChange={(event) => applyGoldPrice(cleanDecimal(event.target.value))}
                                                        placeholder={t('Fills the nisab for you')}
                                                    />
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {t('Nisab = 85 grams of gold')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <Label>{t('Zakat Rate')}</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={form.rate_percent}
                                                        onChange={(event) => set('rate_percent', cleanDecimal(event.target.value))}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <div>
                                                    <Label>{t('Calculation Date')}</Label>
                                                    <Input
                                                        type="date"
                                                        value={form.calculation_date}
                                                        onChange={(event) => set('calculation_date', event.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label>{t('Haul Start Date')}</Label>
                                                    <Input
                                                        type="date"
                                                        value={form.haul_start_date}
                                                        onChange={(event) => set('haul_start_date', event.target.value)}
                                                    />
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {summary.is_haul_met
                                                            ? t('A full lunar year has passed. The haul condition is met.')
                                                            : t('A full lunar year has not passed yet.')}
                                                        {summary.haul_complete_date && (
                                                            <>
                                                                {' '}{t('Haul completes on')}{' '}
                                                                <Num>{formatDate(summary.haul_complete_date)}</Num>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                                <div>
                                                    <Label>{t('Inventory Valuation')}</Label>
                                                    <select
                                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                                        value={form.inventory_valuation_method}
                                                        onChange={(event) => set('inventory_valuation_method', event.target.value)}
                                                    >
                                                        <option value="sale_price">{t('Sale Price')}</option>
                                                        <option value="purchase_price">{t('Purchase Price')}</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <Label>{t('Customer Debt Policy')}</Label>
                                                    <select
                                                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                                        value={form.receivable_policy}
                                                        onChange={(event) => set('receivable_policy', event.target.value)}
                                                    >
                                                        <option value="collectible">{t('Collectible Receivables')}</option>
                                                        <option value="all">{t('All Receivables')}</option>
                                                        <option value="paid_only">{t('Paid Only')}</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <Label>{t('Credit Due Within Days')}</Label>
                                                    <Input
                                                        type="number"
                                                        value={form.liability_due_within_days}
                                                        onChange={(event) => set('liability_due_within_days', event.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={form.show_guidance}
                                                    onChange={(event) => set('show_guidance', event.target.checked)}
                                                />
                                                {t('Show guidance and explanations')}
                                            </label>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}

                        {/* 2. Manual adjustments, optional. */}
                        {step === 1 && (
                            <div className="space-y-4">
                                {adjustments.length === 0 && (
                                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                        {t('Nothing to adjust. Continue to see the amount due.')}
                                    </p>
                                )}

                                <ScrollArea className={adjustments.length > 2 ? 'h-[280px] rounded-lg border' : ''}>
                                    <div className={adjustments.length > 2 ? 'space-y-3 p-3' : 'space-y-3'}>
                                        {adjustments.map((adjustment, index) => (
                                            <div key={index} className="rounded-lg border bg-muted/30 p-3">
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                                                    <select
                                                        className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-3"
                                                        value={adjustment.adjustment_type}
                                                        onChange={(event) => updateAdjustment(index, 'adjustment_type', event.target.value)}
                                                    >
                                                        <option value="addition">{t('Addition')}</option>
                                                        <option value="deduction">{t('Deduction')}</option>
                                                        <option value="exclusion">{t('Exclusion')}</option>
                                                    </select>
                                                    <Input
                                                        className="md:col-span-5"
                                                        value={adjustment.title}
                                                        onChange={(event) => updateAdjustment(index, 'title', event.target.value)}
                                                        placeholder={t('Title')}
                                                    />
                                                    <Input
                                                        className="md:col-span-3"
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={adjustment.amount}
                                                        onChange={(event) => updateAdjustment(index, 'amount', cleanDecimal(event.target.value))}
                                                        placeholder={t('Amount')}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeAdjustment(index)}
                                                        className="md:col-span-1"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    <Input
                                                        className="md:col-span-12"
                                                        value={adjustment.reason}
                                                        onChange={(event) => updateAdjustment(index, 'reason', event.target.value)}
                                                        placeholder={t('Reason')}
                                                    />
                                                </div>

                                                {/* The service silently drops incomplete rows, so say so here. */}
                                                {!isAdjustmentComplete(adjustment) && (
                                                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                                        {t('Fill the title, amount, and reason or this line will be ignored.')}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>

                                <Button type="button" variant="outline" size="sm" onClick={addAdjustment}>
                                    <Plus className="h-4 w-4 me-2" />
                                    {t('Add Adjustment')}
                                </Button>
                            </div>
                        )}

                        {/* 3. The number. */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="rounded-xl border bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 text-center dark:from-emerald-500/10 dark:via-card dark:to-sky-500/10">
                                    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        {t('Zakat Due')}
                                        {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    </p>
                                    <p className="mt-1 text-4xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                        <Num>{money(zakatDue)}</Num>
                                    </p>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        <Num>{money(zakatableAmount)}</Num> × <Num>{form.rate_percent}%</Num>
                                    </p>

                                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                                        <Badge variant={summary.is_nisab_met ? 'default' : 'secondary'}>
                                            {summary.is_nisab_met ? t('Nisab Met') : t('Below Nisab')}
                                        </Badge>
                                        <Badge variant={summary.is_haul_met ? 'default' : 'secondary'}>
                                            {summary.is_haul_met ? t('Haul Met') : t('Haul Not Met')}
                                        </Badge>
                                    </div>

                                    {/* The threshold is usually derived rather than typed,
                                        so it has to be readable without opening anything. */}
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        {t('Nisab')} <Num>{money(form.nisab_amount)}</Num>
                                        {Number(form.gold_price_per_gram || 0) > 0 && (
                                            <>
                                                {' · '}{t('Gold price per gram')} <Num>{money(form.gold_price_per_gram)}</Num>
                                            </>
                                        )}
                                        {' · '}
                                        <button type="button" className="underline hover:text-foreground" onClick={openConditions}>
                                            {t('Change')}
                                        </button>
                                    </p>
                                </div>

                                {!isEligible && (
                                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                        <p className="flex items-start gap-2">
                                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                                            {t('No zakat is due because a condition is not met. You can still save this as a record.')}
                                        </p>
                                        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={openConditions}>
                                            {t('Review the conditions')}
                                        </Button>
                                    </div>
                                )}

                                <div>
                                    <Label>{t('Notes')}</Label>
                                    <Textarea
                                        value={form.notes}
                                        onChange={(event) => set('notes', event.target.value)}
                                        placeholder={t('Optional review notes')}
                                    />
                                </div>

                                {abilities.manageSettings && (
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={saveDefaults}
                                            onChange={(event) => setSaveDefaults(event.target.checked)}
                                        />
                                        {t('Remember these values for next time')}
                                    </label>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Navigation, one row, always in the same place. */}
                <div className="flex items-center justify-between gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep((current) => Math.max(current - 1, 0))}
                        disabled={step === 0}
                    >
                        <ArrowRight className="h-4 w-4 me-2 ltr:rotate-180" />
                        {t('Back')}
                    </Button>

                    {step < lastStep ? (
                        <Button
                            type="button"
                            onClick={() => setStep((current) => Math.min(current + 1, lastStep))}
                            disabled={blocked}
                        >
                            {t('Next')}
                            <ArrowLeft className="h-4 w-4 ms-2 ltr:rotate-180" />
                        </Button>
                    ) : (
                        <Button type="button" onClick={save} disabled={saving || !abilities.create}>
                            {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
                            {t('Save Calculation')}
                        </Button>
                    )}
                </div>

                {/* Reference material and history, out of the way of the flow. */}
                {form.show_guidance && (
                    <Collapsible open={guidanceOpen} onOpenChange={setGuidanceOpen}>
                        <Card>
                            <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-start">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                    <ShieldCheck className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1 font-medium">{t('Instructions and Explanations')}</span>
                                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${guidanceOpen ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
                                    {guidance.map((item) => (
                                        <div key={item.title} className="rounded-lg border bg-muted/30 p-4">
                                            <h3 className="font-semibold text-foreground">{t(item.title)}</h3>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(item.body)}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>
                )}

                <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                    <Card className="overflow-hidden">
                        <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-start">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <FileText className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 font-medium">
                                {t('Recent Zakat Calculations')}
                                <span className="ms-2 text-sm text-muted-foreground">
                                    <Num>{calculations.length}</Num>
                                </span>
                            </span>
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            {calculations.length === 0 ? (
                                <EmptyState
                                    icon={<FileText className="h-10 w-10" />}
                                    title={t('No zakat calculations yet')}
                                    description={t('Complete the steps above to save your first snapshot.')}
                                />
                            ) : (
                                <ScrollArea className="max-h-[360px] border-t">
                                    <ScrollX>
                                        <table className="w-full min-w-[820px] text-sm">
                                            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                                                <tr>
                                                    <th className="p-3 text-start">{t('Number')}</th>
                                                    <th className="p-3 text-start">{t('Date')}</th>
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
                                                        <td className="p-3 text-end tabular-nums"><Num>{money(calculation.zakat_due)}</Num></td>
                                                        <td className="p-3 text-end tabular-nums"><Num>{money(calculation.remaining_amount)}</Num></td>
                                                        <td className="p-3">
                                                            <Badge variant={calculation.status === 'finalized' ? 'default' : 'secondary'}>
                                                                {t(calculation.status)}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-3 text-end">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link href={route('zakat.calculations.show', calculation.id)}>{t('View')}</Link>
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </ScrollX>
                                </ScrollArea>
                            )}
                        </CollapsibleContent>
                    </Card>
                </Collapsible>
            </div>
        </AuthenticatedLayout>
    );
}
