import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Clock3, Target, TrendingUp, Truck, Wallet } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { EmptyState, KpiCard, KpiRow, ScrollX, SectionCard, StatusBadge } from '@/components/ui/page-kit';
import { formatCurrency } from '@/utils/helpers';
import { NOTE_TONES, noteStatusLabel } from '../lib/status';

declare global {
    function route(name: string, params?: any): string;
}

type Ranking = {
    id: number;
    name: string;
    total: number;
    delivered: number;
    pending: number;
    failed: number;
    collected: number;
    success_rate: number;
};

type Props = {
    window_days: number;
    totals: {
        deliveries: number;
        notes: number;
        success_rate: number;
        average_minutes: number;
        collected: number;
        billed: number;
        rounds_total: number;
        rounds_completed: number;
    };
    by_status: Array<{ status: string; count: number }>;
    ranking: Ranking[];
};

const WINDOWS = [7, 30, 90];

const rateTone = (rate: number) => (rate >= 80 ? 'green' : rate >= 50 ? 'orange' : 'red');

export default function Performance() {
    const { t } = useTranslation();
    const { window_days: windowDays, totals, by_status: byStatus, ranking } = usePage<Props>().props;

    const onWindowChange = (days: string) => {
        router.get(
            route('distribution.performance'),
            { days },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    // Recovery rate: how much of what was billed actually came back as cash.
    const recoveryRate = totals.billed > 0 ? Math.round((totals.collected / totals.billed) * 100) : 0;
    const maxStatusCount = Math.max(1, ...byStatus.map((entry) => entry.count));

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Distribution'), url: route('distribution.index') }, { label: t('Driver Performance') }]}
            pageTitle={t('Driver Performance')}
            pageActions={(
                <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={String(windowDays)}
                    onChange={(event) => onWindowChange(event.target.value)}
                >
                    {WINDOWS.map((days) => (
                        <option key={days} value={days}>
                            {t('Last')} {days} {t('days')}
                        </option>
                    ))}
                </select>
            )}
        >
            <Head title={t('Driver Performance')} />

            <div className="mx-auto max-w-7xl space-y-5">
                <p className="text-sm text-muted-foreground">{t('Analyse the performance of your drivers')}</p>

                <KpiRow cols={4}>
                    <KpiCard
                        label={t('Total Deliveries')}
                        value={totals.deliveries}
                        icon={<Truck className="h-5 w-5" />}
                        tone="blue"
                        hint={`${t('of')} ${totals.notes} ${t('delivery notes')}`}
                    />
                    <KpiCard
                        label={t('Success Rate')}
                        value={`${totals.success_rate}%`}
                        icon={<Target className="h-5 w-5" />}
                        tone={rateTone(totals.success_rate)}
                    />
                    <KpiCard
                        label={t('Average Time')}
                        value={`${totals.average_minutes} ${t('min')}`}
                        icon={<Clock3 className="h-5 w-5" />}
                        tone="orange"
                        hint={t('average per delivery note')}
                    />
                    <KpiCard
                        label={t('Collected')}
                        value={formatCurrency(totals.collected)}
                        icon={<Wallet className="h-5 w-5" />}
                        tone="green"
                        hint={`${recoveryRate}% ${t('recovery rate')}`}
                    />
                </KpiRow>

                <div className="grid gap-4 lg:grid-cols-2">
                    <SectionCard title={t('Breakdown by status')}>
                        {byStatus.length === 0 ? (
                            <EmptyState icon={<TrendingUp className="h-8 w-8" />} title={t('No data available')} />
                        ) : (
                            <ul className="space-y-3">
                                {byStatus.map((entry) => (
                                    <li key={entry.status} className="space-y-1">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <StatusBadge tone={NOTE_TONES[entry.status] ?? 'gray'}>
                                                {noteStatusLabel(entry.status, t)}
                                            </StatusBadge>
                                            <span className="tabular-nums text-muted-foreground">{entry.count}</span>
                                        </div>
                                        <div
                                            className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"
                                            role="presentation"
                                        >
                                            <div
                                                className="h-full rounded-full bg-blue-500"
                                                style={{ width: `${(entry.count / maxStatusCount) * 100}%` }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>

                    <SectionCard title={t('Rounds')}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Completed rounds')}</p>
                                <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
                                    {totals.rounds_completed}/{totals.rounds_total}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Billed')}</p>
                                <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
                                    {formatCurrency(totals.billed)}
                                </p>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                <SectionCard title={t('Full ranking')} description={t('Performance of all active drivers')} flush>
                    {ranking.length === 0 ? (
                        <EmptyState icon={<Truck className="h-8 w-8" />} title={t('No driver found')} />
                    ) : (
                        <ScrollX>
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr className="border-b">
                                        <th className="p-3 text-start font-medium">#</th>
                                        <th className="p-3 text-start font-medium">{t('Driver')}</th>
                                        <th className="p-3 text-start font-medium">{t('Delivered')}</th>
                                        <th className="p-3 text-start font-medium">{t('Pending')}</th>
                                        <th className="p-3 text-start font-medium">{t('Failed')}</th>
                                        <th className="p-3 text-start font-medium">{t('Success Rate')}</th>
                                        <th className="p-3 text-start font-medium">{t('Collected')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranking.map((driver, index) => (
                                        <tr key={driver.id} className="border-b last:border-0">
                                            <td className="p-3 tabular-nums text-muted-foreground">{index + 1}</td>
                                            <td className="p-3 font-medium">{driver.name}</td>
                                            <td className="p-3 tabular-nums">{driver.delivered}</td>
                                            <td className="p-3 tabular-nums">{driver.pending}</td>
                                            <td className="p-3 tabular-nums">{driver.failed}</td>
                                            <td className="p-3">
                                                <StatusBadge tone={rateTone(driver.success_rate)}>
                                                    {driver.success_rate}%
                                                </StatusBadge>
                                            </td>
                                            <td className="p-3 tabular-nums">{formatCurrency(driver.collected)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ScrollX>
                    )}
                </SectionCard>
            </div>
        </AuthenticatedLayout>
    );
}
