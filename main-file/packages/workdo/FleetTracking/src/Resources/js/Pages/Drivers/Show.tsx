import { Head, Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock3, MapPin, Radio, Smartphone, Truck, UserRound } from 'lucide-react';
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

type Driver = {
    id: number;
    name: string;
    email: string;
    mobile_no?: string;
};

type Assignment = {
    id: number;
    status: string;
    starts_at?: string | null;
    ends_at?: string | null;
    vehicle?: {
        id: number;
        name: string;
        plate_number: string;
    } | null;
};

type Session = {
    id: number;
    status: string;
    source: string;
    started_at?: string | null;
    last_ping_at?: string | null;
    vehicle?: {
        id: number;
        name: string;
        plate_number: string;
    } | null;
};

type Ping = {
    id: number;
    latitude: number;
    longitude: number;
    speed?: number | null;
    accuracy?: number | null;
    battery?: number | null;
    source: string;
    recorded_at: string;
    vehicle?: {
        id: number;
        name: string;
        plate_number: string;
    } | null;
};

type Props = {
    driver: Driver;
    assignment: Assignment | null;
    session: Session | null;
    pings: Ping[];
};

export default function Show() {
    const { t } = useTranslation();
    const { driver, assignment, session, pings } = usePage<Props>().props;

    const latestPing = pings[0];
    const mapVehicle: FleetMapVehicle | null = latestPing?.vehicle ? {
        id: latestPing.vehicle.id,
        name: latestPing.vehicle.name,
        plate_number: latestPing.vehicle.plate_number,
        tracking_status: session?.status === 'active' ? 'online' : 'offline',
        last_latitude: latestPing.latitude,
        last_longitude: latestPing.longitude,
        last_ping_at: latestPing.recorded_at,
        driver,
    } : null;

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Fleet Tracking'), url: route('fleet-tracking.index') },
                { label: driver.name },
            ]}
            pageTitle={driver.name}
            pageActions={(
                <Button asChild variant="outline" size="sm">
                    <Link href={route('fleet-tracking.index')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('Back')}
                    </Link>
                </Button>
            )}
        >
            <Head title={`${driver.name} - ${t('Fleet Tracking')}`} />

            <div className="mx-auto max-w-7xl space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                <UserRound className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Driver')}</p>
                                <p className="font-semibold">{driver.email}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                                <Truck className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Assigned Vehicle')}</p>
                                <p className="font-semibold">{assignment?.vehicle ? `${assignment.vehicle.name} (${assignment.vehicle.plate_number})` : t('Unassigned')}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Radio className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Tracking Session')}</p>
                                <Badge variant="outline">{session ? t(session.status) : t('offline')}</Badge>
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
                                <p className="font-semibold">{latestPing ? formatDateTime(latestPing.recorded_at) : t('No ping yet')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Driver Location')}</CardTitle>
                            <CardDescription>{t('Latest location sent by this driver during work tracking.')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FleetMap vehicles={mapVehicle ? [mapVehicle] : []} focusedVehicleId={mapVehicle?.id} className="h-[520px]" />
                        </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl">{t('Mobile Tracking')}</CardTitle>
                            <CardDescription>{t('Driver controls the active work tracking session from the mobile page.')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4">
                                <div className="flex items-start gap-3">
                                    <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
                                    <div>
                                        <p className="font-medium">{t('Driver Tracking Page')}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{route('fleet-tracking.mobile')}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border p-4">
                                <p className="text-sm text-muted-foreground">{t('Current Session')}</p>
                                <p className="mt-1 font-semibold">{session ? `${t(session.status)} - ${session.started_at ? formatDateTime(session.started_at) : ''}` : t('No active session')}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                                <p className="text-sm text-muted-foreground">{t('Last Coordinates')}</p>
                                {latestPing ? (
                                    <div className="mt-1 font-semibold">
                                        <MapPin className="mr-1 inline h-4 w-4" />
                                        {latestPing.latitude.toFixed(6)}, {latestPing.longitude.toFixed(6)}
                                    </div>
                                ) : (
                                    <p className="mt-1 font-semibold">-</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl">{t('Driver Activity')}</CardTitle>
                        <CardDescription>{t('Latest 200 location points sent by this driver.')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[430px] rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-muted">
                                    <tr className="border-b text-left">
                                        <th className="p-3">{t('Recorded At')}</th>
                                        <th className="p-3">{t('Vehicle')}</th>
                                        <th className="p-3">{t('Coordinates')}</th>
                                        <th className="p-3">{t('Speed')}</th>
                                        <th className="p-3">{t('Source')}</th>
                                        <th className="p-3">{t('Battery')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pings.map((ping) => (
                                        <tr key={ping.id} className="border-b last:border-0">
                                            <td className="p-3">{formatDateTime(ping.recorded_at)}</td>
                                            <td className="p-3">{ping.vehicle ? `${ping.vehicle.name} (${ping.vehicle.plate_number})` : '-'}</td>
                                            <td className="p-3">{ping.latitude.toFixed(6)}, {ping.longitude.toFixed(6)}</td>
                                            <td className="p-3">{ping.speed ?? 0} km/h</td>
                                            <td className="p-3">{t(ping.source)}</td>
                                            <td className="p-3">{ping.battery !== null && ping.battery !== undefined ? `${ping.battery}%` : '-'}</td>
                                        </tr>
                                    ))}
                                    {pings.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">{t('No driver activity yet.')}</td>
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
