import { useMemo, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Package, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/page-kit';
import { formatCurrency } from '@/utils/helpers';
import { DriverShell } from '../../Components/DriverShell';

type Line = {
    product_id: number;
    name: string;
    sku: string | null;
    quantity: number;
    unit_price: number;
    value: number;
};

type Props = {
    driver: { id: number; name: string };
    lines: Line[];
    summary: { items: number; value: number };
};

export default function DriverStock() {
    const { t } = useTranslation();
    const { driver, lines, summary } = usePage<Props>().props;
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return lines;

        return lines.filter(
            (line) => line.name.toLowerCase().includes(term) || (line.sku ?? '').toLowerCase().includes(term)
        );
    }, [lines, search]);

    return (
        <DriverShell driverName={driver.name} active="stock" title={t('My stock')} subtitle={t('Vehicle stock')}>
            <Head title={t('My stock')} />

            <div className="space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm text-blue-600 dark:text-blue-400">{t('Total value')}</p>
                            <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                                {formatCurrency(summary.value)}
                            </p>
                        </div>
                        <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>

                {lines.length > 0 && (
                    <div className="relative">
                        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="ps-9"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('Search an item...')}
                        />
                    </div>
                )}

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-gray-100 p-4 dark:border-slate-800">
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            {t('Items')} ({filtered.length})
                        </h2>
                    </div>

                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={<Package className="h-10 w-10" />}
                            title={lines.length === 0 ? t('No item in stock') : t('No item matches this search')}
                            description={lines.length === 0 ? t('Stock loaded onto your vehicle appears here') : undefined}
                        />
                    ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                            {filtered.map((line) => (
                                <li key={line.product_id} className="flex items-center justify-between gap-3 p-4">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-gray-900 dark:text-white">{line.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {line.sku ?? '-'} · {formatCurrency(line.unit_price)}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-end">
                                        <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
                                            {line.quantity}
                                        </p>
                                        <p className="text-xs tabular-nums text-muted-foreground">
                                            {formatCurrency(line.value)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </DriverShell>
    );
}
