import { Head, Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import {
    ArrowRightLeft,
    FileText,
    Route as RouteIcon,
    TrendingUp,
    Truck,
    Users,
    Warehouse,
} from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { EmptyState, KpiCard, KpiRow, SectionCard, StatusBadge } from '@/components/ui/page-kit';
import { formatCurrency } from '@/utils/helpers';
import { ROUND_TONES, roundStatusLabel } from '../lib/status';

declare global {
    function route(name: string, params?: any): string;
}

type RoundSummary = {
    id: number;
    reference: string | null;
    status: string;
    round_date: string | null;
    driver: { id: number; name: string } | null;
    stops_total: number;
    stops_done: number;
    collected: number;
};

type Props = {
    summary: {
        rounds_today: number;
        rounds_completed: number;
        notes_pending: number;
        delivered_today: number;
        collected_today: number;
        collected_total: number;
        receivables: number;
        active_drivers: number;
    };
    rounds_today: RoundSummary[];
};

/** Shortcut tile in the hub grid. */
function Shortcut({
    href,
    icon: Icon,
    title,
    hint,
    tone,
}: {
    href: string;
    icon: any;
    title: string;
    hint: string;
    tone: string;
}) {
    return (
        <Link
            href={href}
            className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
        >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
                <span className="block font-medium text-gray-900 dark:text-white">{title}</span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">{hint}</span>
            </span>
        </Link>
    );
}

export default function Index() {
    const { t } = useTranslation();
    const { summary, rounds_today: roundsToday } = usePage<Props>().props;

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Distribution') }]}
            pageTitle={t('Distribution')}
        >
            <Head title={t('Distribution')} />

            <div className="mx-auto max-w-7xl space-y-5">
                <div>
                    <p className="text-sm text-muted-foreground">{t('Manage distribution and deliveries')}</p>
                </div>

                <KpiRow cols={4}>
                    <KpiCard
                        label={t("Today's Rounds")}
                        value={summary.rounds_today}
                        icon={<RouteIcon className="h-5 w-5" />}
                        tone="blue"
                        hint={`${summary.rounds_completed} ${t('completed')}`}
                    />
                    <KpiCard
                        label={t('Pending Delivery Notes')}
                        value={summary.notes_pending}
                        icon={<FileText className="h-5 w-5" />}
                        tone="orange"
                        hint={`${summary.delivered_today} ${t('delivered today')}`}
                    />
                    <KpiCard
                        label={t("Today's Collection")}
                        value={formatCurrency(summary.collected_today)}
                        icon={<TrendingUp className="h-5 w-5" />}
                        tone="green"
                        hint={`${t('Total')} ${formatCurrency(summary.collected_total)}`}
                    />
                    <KpiCard
                        label={t('Customer Receivables')}
                        value={formatCurrency(summary.receivables)}
                        icon={<Truck className="h-5 w-5" />}
                        tone="red"
                    />
                </KpiRow>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Shortcut
                        href={route('distribution.drivers')}
                        icon={Users}
                        title={t('Drivers')}
                        hint={`${summary.active_drivers} ${t('active')}`}
                        tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                    />
                    <Shortcut
                        href={route('warehouses.index')}
                        icon={Warehouse}
                        title={t('Warehouses')}
                        hint={t('Manage stock')}
                        tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
                    />
                    <Shortcut
                        href={route('transfers.index')}
                        icon={ArrowRightLeft}
                        title={t('Transfers')}
                        hint={t('Movements')}
                        tone="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                    />
                    <Shortcut
                        href={route('distribution.rounds')}
                        icon={RouteIcon}
                        title={t('Rounds')}
                        hint={`${summary.rounds_today} ${t('today')}`}
                        tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                    />
                    <Shortcut
                        href={route('distribution.delivery-notes')}
                        icon={FileText}
                        title={t('Delivery Notes')}
                        hint={`${summary.notes_pending} ${t('pending')}`}
                        tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                    />
                    {/* The GPS Map, Distribution Map and Driver Performance tiles are
                        hidden, matching their removal from the sidebar. All three pages
                        still work and are reachable by URL - restore a tile by re-adding
                        a Shortcut for route('fleet-tracking.index'),
                        route('distribution.map') or route('distribution.performance'). */}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <SectionCard title={t("Today's Rounds")}>
                        {roundsToday.length === 0 ? (
                            <EmptyState
                                icon={<RouteIcon className="h-8 w-8" />}
                                title={t('No round found')}
                                action={(
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={route('distribution.rounds')}>{t('See all rounds')}</Link>
                                    </Button>
                                )}
                            />
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                                {roundsToday.map((round) => (
                                    <li key={round.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-gray-900 dark:text-white">
                                                {round.reference ?? `#${round.id}`}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {round.driver?.name ?? t('Unassigned')} · {round.stops_done}/{round.stops_total} {t('stops')}
                                            </p>
                                        </div>
                                        <StatusBadge tone={ROUND_TONES[round.status] ?? 'gray'}>
                                            {roundStatusLabel(round.status, t)}
                                        </StatusBadge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>

                    <SectionCard title={t('Active Drivers')}>
                        {summary.active_drivers === 0 ? (
                            <EmptyState
                                icon={<Users className="h-8 w-8" />}
                                title={t('No driver found')}
                                action={(
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={route('distribution.drivers')}>{t('Manage')}</Link>
                                    </Button>
                                )}
                            />
                        ) : (
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
                                        {summary.active_drivers}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{t('Drivers available for distribution')}</p>
                                </div>
                                <Button asChild variant="outline" size="sm">
                                    <Link href={route('distribution.drivers')}>{t('Manage')}</Link>
                                </Button>
                            </div>
                        )}
                    </SectionCard>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
