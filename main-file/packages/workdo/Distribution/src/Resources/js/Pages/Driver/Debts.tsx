import { FormEvent, useMemo, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Search, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/page-kit';
import { formatCurrency } from '@/utils/helpers';
import { DriverShell } from '../../Components/DriverShell';

declare global {
    function route(name: string, params?: any): string;
}

type Debtor = { customer_id: number; name: string; debt: number; notes: number };

type Props = {
    driver: { id: number; name: string };
    debtors: Debtor[];
    summary: { customers: number; total: number };
};

/** A customer settles what they still owe on deliveries already made. */
function CollectDialog({ debtor, onClose }: { debtor: Debtor; onClose: () => void }) {
    const { t } = useTranslation();
    const form = useForm({ customer_id: debtor.customer_id, amount: debtor.debt });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('distribution.driver.collect'), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{t('Collect a debt')}</DialogTitle>
                        <DialogDescription>
                            {debtor.name} — {formatCurrency(debtor.debt)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2 py-4">
                        <Label htmlFor="amount">{t('Amount collected')}</Label>
                        <Input
                            id="amount"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={debtor.debt}
                            step="0.01"
                            autoFocus
                            value={form.data.amount}
                            onChange={(event) => form.setData('amount', Number(event.target.value))}
                        />
                        <InputError message={form.errors.amount} />
                        {/* Says where the money goes, so a part payment is not a surprise. */}
                        <p className="text-xs text-muted-foreground">
                            {t('Applied to the oldest unpaid delivery note first, and added to your cash.')}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={form.processing || form.data.amount <= 0 || form.data.amount > debtor.debt}
                        >
                            {t('Collect')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function DriverDebts() {
    const { t } = useTranslation();
    const { driver, debtors, summary } = usePage<Props>().props;
    const [search, setSearch] = useState('');
    const [collecting, setCollecting] = useState<Debtor | null>(null);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return term ? debtors.filter((d) => d.name.toLowerCase().includes(term)) : debtors;
    }, [debtors, search]);

    return (
        <DriverShell driverName={driver.name} active="debts" title={t('Customer receivables')} subtitle={t('Collect a debt')}>
            <Head title={t('Customer receivables')} />

            <div className="space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-red-600 dark:text-red-400">{t('Total debts')}</p>
                            <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-300">
                                {formatCurrency(summary.total)}
                            </p>
                        </div>
                        <CreditCard className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                </div>

                {debtors.length > 0 && (
                    <div className="relative">
                        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="ps-9"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('Search a customer...')}
                        />
                    </div>
                )}

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-gray-100 p-4 dark:border-slate-800">
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            {t('Debtors')} ({filtered.length})
                        </h2>
                    </div>

                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={<CreditCard className="h-10 w-10" />}
                            title={debtors.length === 0 ? t('No debt') : t('No customer matches this search')}
                        />
                    ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                            {filtered.map((debtor) => (
                                <li key={debtor.customer_id} className="flex items-center justify-between gap-3 p-4">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-gray-900 dark:text-white">{debtor.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {debtor.notes} {t('unpaid delivery notes')}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                                            {formatCurrency(debtor.debt)}
                                        </p>
                                        <Button size="sm" onClick={() => setCollecting(debtor)}>
                                            <Wallet className="h-4 w-4 me-1.5" />
                                            {t('Collect')}
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {collecting && <CollectDialog debtor={collecting} onClose={() => setCollecting(null)} />}
        </DriverShell>
    );
}
