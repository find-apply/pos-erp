import { useMemo, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/page-kit';
import { formatCurrency } from '@/utils/helpers';
import { DriverShell } from '../../Components/DriverShell';

type Debtor = { customer_id: number; name: string; debt: number; notes: number };

type Props = {
    driver: { id: number; name: string };
    debtors: Debtor[];
    summary: { customers: number; total: number };
};

export default function DriverDebts() {
    const { t } = useTranslation();
    const { driver, debtors, summary } = usePage<Props>().props;
    const [search, setSearch] = useState('');

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
                                            {debtor.notes} {t('delivery notes')}
                                        </p>
                                    </div>
                                    <p className="shrink-0 font-semibold tabular-nums text-red-600 dark:text-red-400">
                                        {formatCurrency(debtor.debt)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </DriverShell>
    );
}
