import { FormEvent, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, CheckCircle, Download, FileText, HelpCircle, Receipt, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/helpers';

type Line = {
    id: number;
    line_type: string;
    title: string;
    description?: string;
    explanation?: string;
    quantity?: string | number | null;
    unit_value?: string | number | null;
    amount: string | number;
    direction: 'asset' | 'deduction' | 'addition' | 'exclusion';
    is_included: boolean;
};

type Calculation = {
    id: number;
    calculation_number: string;
    calculation_date: string;
    haul_start_date?: string;
    nisab_amount: string | number;
    rate_percent: string | number;
    inventory_valuation_method: string;
    liability_due_within_days: number;
    cash_amount: string | number;
    inventory_amount: string | number;
    receivable_amount: string | number;
    deductible_liabilities_amount: string | number;
    manual_additions_amount: string | number;
    manual_deductions_amount: string | number;
    zakatable_amount: string | number;
    zakat_due: string | number;
    paid_amount: string | number;
    remaining_amount: string | number;
    is_nisab_met: boolean;
    is_haul_met: boolean;
    status: string;
    notes?: string;
    finalized_at?: string;
    lines: Line[];
    payments: any[];
};

type BankAccount = {
    id: number;
    account_name: string;
    bank_name?: string;
    current_balance: string | number;
    gl_account_id?: number | null;
};

type Props = {
    calculation: Calculation;
    bankAccounts: BankAccount[];
};

export default function Show() {
    const { t } = useTranslation();
    const { calculation, bankAccounts } = usePage<Props>().props;
    const [paymentForm, setPaymentForm] = useState({
        bank_account_id: '',
        payment_date: new Date().toISOString().slice(0, 10),
        amount: String(calculation.remaining_amount || ''),
        reference_number: '',
        notes: '',
    });

    const groupedLines = useMemo(() => {
        return calculation.lines.reduce<Record<string, Line[]>>((groups, line) => {
            groups[line.direction] = groups[line.direction] || [];
            groups[line.direction].push(line);
            return groups;
        }, {});
    }, [calculation.lines]);

    const finalize = () => {
        router.post(route('zakat.calculations.finalize', calculation.id), {}, { preserveScroll: true });
    };

    const recordPayment = (event: FormEvent) => {
        event.preventDefault();
        router.post(route('zakat.payments.store', calculation.id), paymentForm, { preserveScroll: true });
    };

    const LineTable = ({ title, lines }: { title: string; lines: Line[] }) => (
        <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <CardDescription>{lines.length} {t('lines')}</CardDescription>
                    </div>
                    <Badge variant="secondary">{t('Scrollable')}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[560px] lg:h-[680px]">
                    <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                        <tr>
                            <th className="p-3 text-left">{t('Item')}</th>
                            <th className="p-3 text-left">{t('Source')}</th>
                            <th className="p-3 text-right">{t('Qty')}</th>
                            <th className="p-3 text-right">{t('Unit Value')}</th>
                            <th className="p-3 text-right">{t('Amount')}</th>
                            <th className="p-3 text-center">{t('Reason')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line) => (
                            <tr key={line.id} className="border-t align-top transition-colors hover:bg-muted/30">
                                <td className="p-3">
                                    <div className="font-medium">{line.title}</div>
                                    <div className="text-xs text-muted-foreground">{line.line_type}</div>
                                </td>
                                <td className="p-3 text-muted-foreground">{line.description || '-'}</td>
                                <td className="p-3 text-right tabular-nums">{line.quantity || '-'}</td>
                                <td className="p-3 text-right tabular-nums">{line.unit_value ? formatCurrency(line.unit_value) : '-'}</td>
                                <td className="p-3 text-right font-medium tabular-nums">{formatCurrency(line.amount)}</td>
                                <td className="p-3 text-center">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger type="button" className="inline-flex items-center justify-center h-8 w-8 rounded border">
                                                <HelpCircle className="h-4 w-4" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-sm">
                                                <p>{line.explanation}</p>
                                                {!line.is_included && <p className="mt-1 font-medium">{t('This line is shown for transparency and is not included.')}</p>}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </td>
                            </tr>
                        ))}
                        {lines.length === 0 && (
                            <tr>
                                <td className="p-10 text-center text-muted-foreground" colSpan={6}>{t('No records')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Zakat') },
                { label: calculation.calculation_number },
            ]}
            pageTitle={calculation.calculation_number}
        >
            <Head title={calculation.calculation_number} />

            <div className="mx-auto max-w-7xl space-y-6">
                <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-slate-50 via-white to-emerald-50 shadow-sm">
                    <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                                <FileText className="h-6 w-6" />
                            </div>
                            <div>
                                <Button variant="ghost" size="sm" asChild className="-ms-3 mb-2">
                                    <Link href={route('zakat.index')}>
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        {t('Back')}
                                    </Link>
                                </Button>
                                <h2 className="text-2xl font-semibold tracking-tight">{calculation.calculation_number}</h2>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge variant={calculation.status === 'finalized' ? 'default' : 'secondary'}>{t(calculation.status)}</Badge>
                                    <Badge variant={calculation.is_nisab_met ? 'default' : 'secondary'}>{calculation.is_nisab_met ? t('Nisab Met') : t('Below Nisab')}</Badge>
                                    <Badge variant={calculation.is_haul_met ? 'default' : 'secondary'}>{calculation.is_haul_met ? t('Haul Met') : t('Haul Not Met')}</Badge>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {calculation.status !== 'finalized' && (
                                <Button onClick={finalize}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    {t('Finalize')}
                                </Button>
                            )}
                            {calculation.status === 'finalized' && (
                                <Button variant="outline" onClick={() => window.open(route('zakat.calculations.report', calculation.id) + '?download=pdf', '_blank')}>
                                    <Download className="h-4 w-4 mr-2" />
                                    {t('Download Report')}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <Card className="overflow-hidden border-border/70 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl">{t('Zakat Calculation Summary')}</CardTitle>
                                <CardDescription>
                                    {formatDate(calculation.calculation_date)}
                                    {calculation.haul_start_date ? ` • ${t('Haul from')} ${formatDate(calculation.haul_start_date)}` : ''}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                                <ShieldCheck className="h-4 w-4" />
                                {t('Snapshot audit trail')}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div className="rounded-lg border bg-card p-4">
                                <p className="text-sm text-muted-foreground">{t('Assets Before Deductions')}</p>
                                <p className="text-xl font-semibold tabular-nums">
                                    {formatCurrency(Number(calculation.cash_amount) + Number(calculation.inventory_amount) + Number(calculation.receivable_amount) + Number(calculation.manual_additions_amount))}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-card p-4">
                                <p className="text-sm text-muted-foreground">{t('Deductions')}</p>
                                <p className="text-xl font-semibold tabular-nums">
                                    {formatCurrency(Number(calculation.deductible_liabilities_amount) + Number(calculation.manual_deductions_amount))}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-card p-4">
                                <p className="text-sm text-muted-foreground">{t('Zakatable Base')}</p>
                                <p className="text-xl font-semibold tabular-nums">{formatCurrency(calculation.zakatable_amount)}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <p className="text-sm text-muted-foreground">{t('Zakat Due')}</p>
                                <p className="text-xl font-semibold tabular-nums">{formatCurrency(calculation.zakat_due)}</p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm leading-6">
                            <p className="font-medium">{t('Formula')}</p>
                            <p>{t('Cash and bank + trade inventory + collectible receivables + additions - due liabilities - deductions = zakatable base.')}</p>
                            <p className="mt-2 text-muted-foreground">
                                {t('The saved lines below are the audit trail. They will not change after finalization, even if invoices, stock, or bank balances change later.')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <LineTable title={t('Included Assets')} lines={[...(groupedLines.asset || []), ...(groupedLines.addition || [])]} />
                    <LineTable title={t('Deductions and Exclusions')} lines={[...(groupedLines.deduction || []), ...(groupedLines.exclusion || [])]} />
                </div>

                {calculation.status === 'finalized' && (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="border-border/70 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-xl">{t('Record Zakat Payment')}</CardTitle>
                                <CardDescription>{t('Record a payment only after the calculation is finalized.')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={recordPayment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>{t('Bank Account')}</Label>
                                        <select className="w-full h-10 rounded-md border px-3 text-sm" value={paymentForm.bank_account_id} onChange={(event) => setPaymentForm({ ...paymentForm, bank_account_id: event.target.value })}>
                                            <option value="">{t('Select Bank Account')}</option>
                                            {bankAccounts.map((account) => (
                                                <option key={account.id} value={account.id}>
                                                    {account.account_name} - {formatCurrency(account.current_balance)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <Label>{t('Payment Date')}</Label>
                                        <Input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })} />
                                    </div>
                                    <div>
                                        <Label>{t('Amount')}</Label>
                                        <Input type="number" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
                                    </div>
                                    <div>
                                        <Label>{t('Reference')}</Label>
                                        <Input value={paymentForm.reference_number} onChange={(event) => setPaymentForm({ ...paymentForm, reference_number: event.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label>{t('Notes')}</Label>
                                        <Textarea value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Button type="submit" disabled={Number(calculation.remaining_amount) <= 0}>
                                            <Receipt className="h-4 w-4 mr-2" />
                                            {t('Record Payment')}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-xl">{t('Payment Summary')}</CardTitle>
                                <CardDescription>{t('Payments are linked to the finalized zakat snapshot.')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-lg border bg-card p-3">
                                        <p className="text-xs text-muted-foreground">{t('Due')}</p>
                                        <p className="font-semibold tabular-nums">{formatCurrency(calculation.zakat_due)}</p>
                                    </div>
                                    <div className="rounded-lg border bg-card p-3">
                                        <p className="text-xs text-muted-foreground">{t('Paid')}</p>
                                        <p className="font-semibold tabular-nums">{formatCurrency(calculation.paid_amount)}</p>
                                    </div>
                                    <div className="rounded-lg border bg-card p-3">
                                        <p className="text-xs text-muted-foreground">{t('Remaining')}</p>
                                        <p className="font-semibold tabular-nums">{formatCurrency(calculation.remaining_amount)}</p>
                                    </div>
                                </div>
                                <ScrollArea className="max-h-[280px] rounded-lg border">
                                    <div className="overflow-x-auto">
                                    <table className="w-full min-w-[560px] text-sm">
                                        <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                                            <tr>
                                                <th className="p-2 text-left">{t('Date')}</th>
                                                <th className="p-2 text-left">{t('Bank Account')}</th>
                                                <th className="p-2 text-right">{t('Amount')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calculation.payments.length > 0 ? calculation.payments.map((payment) => (
                                                <tr key={payment.id} className="border-t">
                                                    <td className="p-2">{formatDate(payment.payment_date)}</td>
                                                    <td className="p-2">{payment.bank_account?.account_name || '-'}</td>
                                                    <td className="p-2 text-right tabular-nums">{formatCurrency(payment.amount)}</td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={3} className="p-6 text-center text-muted-foreground">{t('No payments recorded yet')}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
