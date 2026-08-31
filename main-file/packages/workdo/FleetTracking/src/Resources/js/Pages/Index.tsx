import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Clock3, MapPin, Radio, RefreshCw, Search, Settings, ShieldCheck, Smartphone, Truck } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, KpiCard, KpiRow, ScrollX, SectionCard, StatusBadge } from '@/components/ui/page-kit';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/helpers';
import FleetMap, { FleetMapVehicle } from '../Components/FleetMap';

declare global {
    function route(name: string, params?: any): string;
}

type Props = {
    vehicles: FleetMapVehicle[];
    summary: {
        total: number;
        online: number;
        stale: number;
        offline: number;
    };
};

/**
 * How often the map pulls fresh positions. The backend flips a vehicle to
 * "stale" after 10 minutes, so this only has to be frequent enough to feel
 * live to a dispatcher watching the screen.
 */
const POLL_INTERVAL_MS = 30_000;

const TRACKING_TONES: Record<string, 'green' | 'orange' | 'gray'> = {
    online: 'green',
    stale: 'orange',
};

export default function Index() {
    const { t } = useTranslation();
    const { vehicles, summary } = usePage<Props>().props;
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());

    const refresh = useMemo(
        () => () =>
            router.reload({
                only: ['vehicles', 'summary'],
                onStart: () => setIsRefreshing(true),
                onFinish: () => {
                    setIsRefreshing(false);
                    setLastUpdated(new Date());
                },
            }),
        []
    );

    // Poll for fresh positions. Driver phones push pings continuously, but
    // without this the dispatcher's map stayed frozen until a manual reload.
    useEffect(() => {
        const tick = () => {
            // Skip while the tab is in the background - nobody is watching, and
            // the next visibilitychange refreshes immediately anyway.
            if (document.hidden) return;
            refresh();
        };

        const interval = window.setInterval(tick, POLL_INTERVAL_MS);
        const onVisibilityChange = () => {
            if (!document.hidden) refresh();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [refresh]);

    const filteredVehicles = useMemo(() => {
        return vehicles.filter((vehicle) => {
            const statusMatch = status === 'all' || vehicle.tracking_status === status;
            const term = search.toLowerCase();
            const searchMatch = !term
                || vehicle.name.toLowerCase().includes(term)
                || vehicle.plate_number.toLowerCase().includes(term)
                || vehicle.driver?.name?.toLowerCase().includes(term);

            return statusMatch && searchMatch;
        });
    }, [search, status, vehicles]);

    const statusLabel = (value: string) =>
        ({ online: t('Online'), stale: t('Stale'), offline: t('Offline') })[value] ?? value;

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Fleet Tracking') }]}
            pageTitle={t('Fleet Tracking')}
            pageActions={(
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                        {/* Points at the registry, not the intake config -
                            from the map the useful next step is the vehicle
                            list, and intake settings sit one click on from it. */}
                        <Link href={route('fleet-tracking.vehicles.index')}>
                            <Settings className="me-2 h-4 w-4" />
                            {t('Vehicles')}
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('fleet-tracking.mobile')}>
                            <Smartphone className="me-2 h-4 w-4" />
                            {t('Driver Tracking')}
                        </Link>
                    </Button>
                </div>
            )}
        >
            <Head title={t('Fleet Tracking')} />

            <div className="mx-auto max-w-7xl space-y-5">
                <SectionCard>
                    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <Truck className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('Transport Fleet Live Map')}</h2>
                                    <StatusBadge tone="blue">OpenStreetMap</StatusBadge>
                                </div>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                    {t('Track company vehicles during work sessions using driver mobile GPS, with a device-token endpoint ready for GPS SIM or OBD devices.')}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-4">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{t('Work-hours privacy')}</p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        {t('Location is accepted only after an explicit tracking session starts. AirTag and SmartTag references are stored as notes, not live ERP tracking sources.')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                <KpiRow cols={4}>
                    <KpiCard label={t('Vehicles')} value={summary.total} icon={<Truck className="h-5 w-5" />} tone="gray" />
                    <KpiCard label={t('Online')} value={summary.online} icon={<Radio className="h-5 w-5" />} tone="green" />
                    <KpiCard label={t('Stale')} value={summary.stale} icon={<Clock3 className="h-5 w-5" />} tone="orange" />
                    <KpiCard label={t('Offline')} value={summary.offline} icon={<MapPin className="h-5 w-5" />} tone="red" />
                </KpiRow>

                <SectionCard
                    title={t('Live Fleet Map')}
                    description={t('Markers change status when the last GPS ping becomes stale after 10 minutes.')}
                    actions={(
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                            <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                                </span>
                                {t('Updated')} {lastUpdated.toLocaleTimeString()}
                            </span>
                            <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
                                <RefreshCw className={cn('me-2 h-4 w-4', isRefreshing && 'animate-spin')} />
                                {t('Refresh')}
                            </Button>
                        </div>
                    )}
                >
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                        <div className="relative">
                            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="ps-9 sm:w-64" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search vehicle or driver')} />
                        </div>
                        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                            <option value="all">{t('All statuses')}</option>
                            <option value="online">{t('Online')}</option>
                            <option value="stale">{t('Stale')}</option>
                            <option value="offline">{t('Offline')}</option>
                        </select>
                    </div>

                    <div className="space-y-4">
                        <FleetMap vehicles={filteredVehicles} />

                        <ScrollArea className="h-[360px] rounded-lg border">
                            <ScrollX>
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-muted">
                                        <tr className="border-b">
                                            <th className="p-3 text-start font-medium">{t('Vehicle')}</th>
                                            <th className="p-3 text-start font-medium">{t('Driver')}</th>
                                            <th className="p-3 text-start font-medium">{t('Status')}</th>
                                            <th className="p-3 text-start font-medium">{t('Last Ping')}</th>
                                            <th className="p-3 text-start font-medium">{t('Source')}</th>
                                            <th className="p-3 text-end font-medium">{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVehicles.map((vehicle) => (
                                            <tr key={vehicle.id} className="border-b last:border-0">
                                                <td className="p-3">
                                                    <div className="font-medium">{vehicle.name}</div>
                                                    <div className="text-xs text-muted-foreground">{vehicle.plate_number}</div>
                                                </td>
                                                <td className="p-3">
                                                    {vehicle.driver ? (
                                                        <Link href={route('fleet-tracking.drivers.show', vehicle.driver.id)} className="font-medium text-primary hover:underline">
                                                            {vehicle.driver.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-muted-foreground">{t('Unassigned')}</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <StatusBadge tone={TRACKING_TONES[vehicle.tracking_status] ?? 'gray'}>
                                                        {statusLabel(vehicle.tracking_status)}
                                                    </StatusBadge>
                                                </td>
                                                <td className="p-3">{vehicle.last_ping_at ? formatDateTime(vehicle.last_ping_at) : t('No ping yet')}</td>
                                                <td className="p-3">{vehicle.last_source ? t(vehicle.last_source) : '-'}</td>
                                                <td className="p-3 text-end">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={route('fleet-tracking.vehicles.show', vehicle.id)}>{t('Open')}</Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredVehicles.length === 0 && (
                                            <tr>
                                                <td colSpan={6}>
                                                    <EmptyState
                                                        icon={<Truck className="h-8 w-8" />}
                                                        title={t('No vehicles found.')}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </ScrollX>
                        </ScrollArea>
                    </div>
                </SectionCard>

            </div>
        </AuthenticatedLayout>
    );
}
