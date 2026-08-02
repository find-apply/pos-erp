import { useMemo, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Clock3, MapPin, Radio, Search, Settings, ShieldCheck, Smartphone, Truck } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const statusBadge = (status: string) => {
    if (status === 'online') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'stale') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function Index() {
    const { t } = useTranslation();
    const { vehicles, summary } = usePage<Props>().props;
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');

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

    const SummaryTile = ({ label, value, icon: Icon, className }: { label: string; value: number; icon: any; className: string }) => (
        <Card className="border-border/70 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${className}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Fleet Tracking') }]}
            pageTitle={t('Fleet Tracking')}
            pageActions={(
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('fleet-tracking.settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            {t('Fleet Settings')}
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('fleet-tracking.mobile')}>
                            <Smartphone className="mr-2 h-4 w-4" />
                            {t('Driver Tracking')}
                        </Link>
                    </Button>
                </div>
            )}
        >
            <Head title={t('Fleet Tracking')} />

            <div className="mx-auto max-w-7xl space-y-5">
                <div className="rounded-lg border bg-white shadow-sm">
                    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_380px]">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                                <Truck className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-2xl font-semibold">{t('Transport Fleet Live Map')}</h2>
                                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                                        OpenStreetMap
                                    </Badge>
                                </div>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                    {t('Track company vehicles during work sessions using driver mobile GPS, with a device-token endpoint ready for GPS SIM or OBD devices.')}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-4">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
                                <div>
                                    <p className="font-medium">{t('Work-hours privacy')}</p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        {t('Location is accepted only after an explicit tracking session starts. AirTag and SmartTag references are stored as notes, not live ERP tracking sources.')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <SummaryTile label={t('Vehicles')} value={summary.total} icon={Truck} className="bg-slate-100 text-slate-700" />
                    <SummaryTile label={t('Online')} value={summary.online} icon={Radio} className="bg-emerald-50 text-emerald-700" />
                    <SummaryTile label={t('Stale')} value={summary.stale} icon={Clock3} className="bg-amber-50 text-amber-700" />
                    <SummaryTile label={t('Offline')} value={summary.offline} icon={MapPin} className="bg-rose-50 text-rose-700" />
                </div>

                <Card className="border-border/70 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <CardTitle className="text-xl">{t('Live Fleet Map')}</CardTitle>
                                <CardDescription>{t('Markers change status when the last GPS ping becomes stale after 10 minutes.')}</CardDescription>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input className="pl-9 sm:w-64" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search vehicle or driver')} />
                                </div>
                                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                                    <option value="all">{t('All statuses')}</option>
                                    <option value="online">{t('Online')}</option>
                                    <option value="stale">{t('Stale')}</option>
                                    <option value="offline">{t('Offline')}</option>
                                </select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FleetMap vehicles={filteredVehicles} />

                        <ScrollArea className="h-[360px] rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-muted">
                                    <tr className="border-b text-left">
                                        <th className="p-3">{t('Vehicle')}</th>
                                        <th className="p-3">{t('Driver')}</th>
                                        <th className="p-3">{t('Status')}</th>
                                        <th className="p-3">{t('Last Ping')}</th>
                                        <th className="p-3">{t('Source')}</th>
                                        <th className="p-3 text-right">{t('Actions')}</th>
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
                                                <Badge variant="outline" className={statusBadge(vehicle.tracking_status)}>
                                                    {t(vehicle.tracking_status)}
                                                </Badge>
                                            </td>
                                            <td className="p-3">{vehicle.last_ping_at ? formatDateTime(vehicle.last_ping_at) : t('No ping yet')}</td>
                                            <td className="p-3">{vehicle.last_source ? t(vehicle.last_source) : '-'}</td>
                                            <td className="p-3 text-right">
                                                <Button asChild variant="outline" size="sm">
                                                    <Link href={route('fleet-tracking.vehicles.show', vehicle.id)}>{t('Open')}</Link>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredVehicles.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">{t('No vehicles found.')}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </CardContent>
                </Card>

            </div>
        </AuthenticatedLayout>
    );
}
