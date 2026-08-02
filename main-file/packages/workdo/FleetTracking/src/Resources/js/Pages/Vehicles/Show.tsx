import { Head, Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock3, Gauge, MapPin, Radio, Truck, UserRound } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDateTime } from '@/utils/helpers';
import FleetMap, { FleetMapVehicle } from '../../Components/FleetMap';

declare global {
    function route(name: string, params?: any): string;
}

type Ping = {
    id: number;
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
    battery?: number | null;
    source: string;
    recorded_at: string;
    driver?: { id: number; name: string } | null;
};

type Assignment = {
    id: number;
    status: string;
    starts_at?: string | null;
    ends_at?: string | null;
    notes?: string | null;
    driver?: { id: number; name: string; email?: string } | null;
};

type Props = {
    vehicle: FleetMapVehicle & {
        status: string;
        last_speed?: number | null;
        last_accuracy?: number | null;
        has_device_token?: boolean;
        gps_device_name?: string | null;
        airtag_reference?: string | null;
        notes?: string | null;
    };
    pings: Ping[];
    assignments: Assignment[];
};

const statusBadge = (status: string) => {
    if (status === 'online') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'stale') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function Show() {
    const { t } = useTranslation();
    const { vehicle, pings, assignments } = usePage<Props>().props;

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Fleet Tracking'), url: route('fleet-tracking.index') },
                { label: vehicle.name },
            ]}
            pageTitle={vehicle.name}
            pageActions={(
                <Button asChild variant="outline" size="sm">
                    <Link href={route('fleet-tracking.index')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('Back')}
                    </Link>
                </Button>
            )}
        >
            <Head title={`${vehicle.name} - ${t('Fleet Tracking')}`} />

            <div className="mx-auto max-w-7xl space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                <Truck className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Plate Number')}</p>
                                <p className="font-semibold">{vehicle.plate_number}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Radio className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Tracking Status')}</p>
                                <Badge variant="outline" className={statusBadge(vehicle.tracking_status)}>{t(vehicle.tracking_status)}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                                <Gauge className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Last Speed')}</p>
                                <p className="font-semibold">{vehicle.last_speed ?? 0} km/h</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                                <Clock3 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Last Ping')}</p>
                                <p className="font-semibold">{vehicle.last_ping_at ? formatDateTime(vehicle.last_ping_at) : t('No ping yet')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Vehicle Route Map')}</CardTitle>
                            <CardDescription>{t('Latest known position for this vehicle.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FleetMap vehicles={[vehicle]} focusedVehicleId={vehicle.id} className="h-[520px]" />
                        </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Current Driver')}</CardTitle>
                            <CardDescription>{t('Active assignment and tracking source details.')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4">
                                <div className="flex items-center gap-3">
                                    <UserRound className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('Driver')}</p>
                                        {vehicle.driver ? (
                                            <Link className="font-semibold text-primary hover:underline" href={route('fleet-tracking.drivers.show', vehicle.driver.id)}>
                                                {vehicle.driver.name}
                                            </Link>
                                        ) : (
                                            <p className="font-semibold">{t('Unassigned')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border p-4">
                                <p className="text-sm text-muted-foreground">{t('GPS Device')}</p>
                                <p className="mt-1 font-semibold">{vehicle.gps_device_name || (vehicle.has_device_token ? t('Device token configured') : t('No device configured'))}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                                <p className="text-sm text-muted-foreground">{t('AirTag or SmartTag Reference')}</p>
                                <p className="mt-1 font-semibold">{vehicle.airtag_reference || '-'}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                                <p className="text-sm text-muted-foreground">{t('Notes')}</p>
                                <p className="mt-1 text-sm leading-6">{vehicle.notes || '-'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Location History')}</CardTitle>
                            <CardDescription>{t('Latest 200 GPS pings for this vehicle.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[420px] rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-muted">
                                        <tr className="border-b text-left">
                                            <th className="p-3">{t('Recorded At')}</th>
                                            <th className="p-3">{t('Driver')}</th>
                                            <th className="p-3">{t('Coordinates')}</th>
                                            <th className="p-3">{t('Source')}</th>
                                            <th className="p-3">{t('Battery')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pings.map((ping) => (
                                            <tr key={ping.id} className="border-b last:border-0">
                                                <td className="p-3">{formatDateTime(ping.recorded_at)}</td>
                                                <td className="p-3">{ping.driver?.name || '-'}</td>
                                                <td className="p-3">
                                                    <div>{ping.latitude.toFixed(6)}</div>
                                                    <div className="text-xs text-muted-foreground">{ping.longitude.toFixed(6)}</div>
                                                </td>
                                                <td className="p-3">{t(ping.source)}</td>
                                                <td className="p-3">{ping.battery !== null && ping.battery !== undefined ? `${ping.battery}%` : '-'}</td>
                                            </tr>
                                        ))}
                                        {pings.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">{t('No location history yet.')}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Assignment History')}</CardTitle>
                            <CardDescription>{t('Recent drivers assigned to this vehicle.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[420px] rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-muted">
                                        <tr className="border-b text-left">
                                            <th className="p-3">{t('Driver')}</th>
                                            <th className="p-3">{t('Status')}</th>
                                            <th className="p-3">{t('Starts At')}</th>
                                            <th className="p-3">{t('Ends At')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignments.map((assignment) => (
                                            <tr key={assignment.id} className="border-b last:border-0">
                                                <td className="p-3">{assignment.driver?.name || '-'}</td>
                                                <td className="p-3">{t(assignment.status)}</td>
                                                <td className="p-3">{assignment.starts_at ? formatDateTime(assignment.starts_at) : '-'}</td>
                                                <td className="p-3">{assignment.ends_at ? formatDateTime(assignment.ends_at) : '-'}</td>
                                            </tr>
                                        ))}
                                        {assignments.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-muted-foreground">{t('No assignments yet.')}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
