import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Cable, CarFront, ClipboardCheck, KeyRound, Plus, Radio, Route, ShieldCheck, Truck, UserRound } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/utils/helpers';
import { FleetMapVehicle } from '../Components/FleetMap';

declare global {
    function route(name: string, params?: any): string;
}

type Driver = {
    id: number;
    name: string;
    email: string;
    mobile_no?: string;
    type?: string;
};

type Props = {
    vehicles: FleetMapVehicle[];
    drivers: Driver[];
    summary: {
        total: number;
        online: number;
        stale: number;
        offline: number;
    };
    device_endpoint: string;
};

const statusBadge = (status: string) => {
    if (status === 'online') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'stale') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

const emptyVehicleForm = {
    name: '',
    plate_number: '',
    vehicle_type: 'van',
    status: 'active',
    gps_device_token: '',
    gps_device_name: '',
    airtag_reference: '',
    notes: '',
};

export default function SettingsPage() {
    const { t } = useTranslation();
    const { vehicles, drivers, summary, device_endpoint } = usePage<Props>().props;
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
    const [assignmentForm, setAssignmentForm] = useState({
        vehicle_id: '',
        driver_id: '',
        starts_at: '',
        ends_at: '',
        notes: '',
    });

    const deviceReadyVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.has_device_token).length, [vehicles]);
    const assignedVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.driver).length, [vehicles]);
    const selectedVehicle = useMemo(() => vehicles.find((vehicle) => String(vehicle.id) === selectedVehicleId), [selectedVehicleId, vehicles]);

    useEffect(() => {
        if (!selectedVehicle) {
            setVehicleForm(emptyVehicleForm);
            return;
        }

        setVehicleForm({
            name: selectedVehicle.name,
            plate_number: selectedVehicle.plate_number,
            vehicle_type: selectedVehicle.vehicle_type || 'van',
            status: selectedVehicle.status || 'active',
            gps_device_token: '',
            gps_device_name: selectedVehicle.gps_device_name || '',
            airtag_reference: selectedVehicle.airtag_reference || '',
            notes: selectedVehicle.notes || '',
        });
    }, [selectedVehicle]);

    const saveVehicle = (event: FormEvent) => {
        event.preventDefault();
        const payload: Record<string, string> = { ...vehicleForm };

        if (selectedVehicleId && !payload.gps_device_token?.trim()) {
            delete payload.gps_device_token;
        }

        const request = selectedVehicleId
            ? router.put(route('fleet-tracking.vehicles.update', selectedVehicleId), payload, {
                preserveScroll: true,
                onSuccess: () => setVehicleForm((current) => ({ ...current, gps_device_token: '' })),
            })
            : router.post(route('fleet-tracking.vehicles.store'), payload, {
                preserveScroll: true,
                onSuccess: () => setVehicleForm(emptyVehicleForm),
            });

        return request;
    };

    const createVehicle = () => {
        setSelectedVehicleId('');
        setVehicleForm(emptyVehicleForm);
    };

    const editVehicle = (vehicle: FleetMapVehicle) => {
        setSelectedVehicleId(String(vehicle.id));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const createAssignment = (event: FormEvent) => {
        event.preventDefault();
        router.post(route('fleet-tracking.assignments.store'), assignmentForm, {
            preserveScroll: true,
            onSuccess: () => setAssignmentForm({
                vehicle_id: '',
                driver_id: '',
                starts_at: '',
                ends_at: '',
                notes: '',
            }),
        });
    };

    const StatTile = ({ label, value, icon: Icon, className }: { label: string; value: number; icon: any; className: string }) => (
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
            breadcrumbs={[
                { label: t('Fleet Tracking'), url: route('fleet-tracking.index') },
                { label: t('Fleet Settings') },
            ]}
            pageTitle={t('Fleet Settings')}
            pageActions={(
                <Button asChild variant="outline" size="sm">
                    <Link href={route('fleet-tracking.index')}>
                        <Truck className="mr-2 h-4 w-4" />
                        {t('Back to Map')}
                    </Link>
                </Button>
            )}
        >
            <Head title={t('Fleet Settings')} />

            <div className="mx-auto max-w-7xl space-y-5">
                <div className="rounded-lg border bg-white shadow-sm">
                    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_380px]">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                                <CarFront className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl font-semibold">{t('Vehicle and Device Settings')}</h2>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                                    {t('Create company vehicles, save GPS device tokens, keep optional AirTag references, and assign drivers before work tracking starts.')}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-lg border bg-muted/20 p-4">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
                                <div>
                                    <p className="font-medium">{t('Device intake endpoint')}</p>
                                    <p className="mt-1 break-all rounded-md bg-white px-3 py-2 text-xs text-muted-foreground">{device_endpoint}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <StatTile label={t('Vehicles')} value={summary.total} icon={Truck} className="bg-slate-100 text-slate-700" />
                    <StatTile label={t('Configured Devices')} value={deviceReadyVehicles} icon={Cable} className="bg-sky-50 text-sky-700" />
                    <StatTile label={t('Assigned Vehicles')} value={assignedVehicles} icon={UserRound} className="bg-emerald-50 text-emerald-700" />
                    <StatTile label={t('Offline')} value={summary.offline} icon={Radio} className="bg-rose-50 text-rose-700" />
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                    <Truck className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">{selectedVehicle ? t('Update Vehicle or Device') : t('Add Vehicle or Tracking Device')}</CardTitle>
                                    <CardDescription>{t('Use GPS Device Token for SIM or OBD trackers. AirTag and SmartTag stay as reference notes only.')}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={saveVehicle} className="grid gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <Label>{t('Vehicle Record')}</Label>
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)}>
                                            <option value="">{t('New vehicle')}</option>
                                            {vehicles.map((vehicle) => (
                                                <option key={vehicle.id} value={vehicle.id}>{vehicle.name} - {vehicle.plate_number}</option>
                                            ))}
                                        </select>
                                        {selectedVehicle && (
                                            <Button type="button" variant="outline" onClick={createVehicle}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                {t('New vehicle')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label>{t('Vehicle Name')}</Label>
                                    <Input value={vehicleForm.name} onChange={(event) => setVehicleForm({ ...vehicleForm, name: event.target.value })} required />
                                </div>
                                <div>
                                    <Label>{t('Plate Number')}</Label>
                                    <Input value={vehicleForm.plate_number} onChange={(event) => setVehicleForm({ ...vehicleForm, plate_number: event.target.value })} required />
                                </div>
                                <div>
                                    <Label>{t('Vehicle Type')}</Label>
                                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleForm.vehicle_type} onChange={(event) => setVehicleForm({ ...vehicleForm, vehicle_type: event.target.value })}>
                                        <option value="van">{t('Van')}</option>
                                        <option value="truck">{t('Truck')}</option>
                                        <option value="car">{t('Car')}</option>
                                        <option value="motorcycle">{t('Motorcycle')}</option>
                                        <option value="other">{t('Other')}</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>{t('Vehicle Status')}</Label>
                                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleForm.status} onChange={(event) => setVehicleForm({ ...vehicleForm, status: event.target.value })}>
                                        <option value="active">{t('Active')}</option>
                                        <option value="maintenance">{t('Maintenance')}</option>
                                        <option value="inactive">{t('Inactive')}</option>
                                    </select>
                                </div>
                                <div>
                                    <Label>{selectedVehicle ? t('Replace GPS Device Token') : t('GPS Device Token')}</Label>
                                    <Input value={vehicleForm.gps_device_token} onChange={(event) => setVehicleForm({ ...vehicleForm, gps_device_token: event.target.value })} placeholder="gps-device-token" />
                                    {selectedVehicle?.has_device_token && (
                                        <p className="mt-1 text-xs text-muted-foreground">{t('Leave token empty to keep current token.')}</p>
                                    )}
                                </div>
                                <div>
                                    <Label>{t('GPS Device Name')}</Label>
                                    <Input value={vehicleForm.gps_device_name} onChange={(event) => setVehicleForm({ ...vehicleForm, gps_device_name: event.target.value })} placeholder="SIM GPS / OBD" />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>{t('AirTag or SmartTag Reference')}</Label>
                                    <Input value={vehicleForm.airtag_reference} onChange={(event) => setVehicleForm({ ...vehicleForm, airtag_reference: event.target.value })} />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>{t('Notes')}</Label>
                                    <Textarea value={vehicleForm.notes} onChange={(event) => setVehicleForm({ ...vehicleForm, notes: event.target.value })} />
                                </div>
                                <div className="md:col-span-2">
                                    <Button type="submit">
                                        {selectedVehicle ? <ClipboardCheck className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                                        {selectedVehicle ? t('Save Vehicle') : t('Create Vehicle')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="space-y-5">
                        <Card className="border-border/70 shadow-sm">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                                        <Route className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">{t('Assign Driver')}</CardTitle>
                                        <CardDescription>{t('Connect a driver to a vehicle before mobile work tracking starts.')}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={createAssignment} className="grid gap-4">
                                    <div>
                                        <Label>{t('Vehicle')}</Label>
                                        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={assignmentForm.vehicle_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, vehicle_id: event.target.value })} required>
                                            <option value="">{t('Select vehicle')}</option>
                                            {vehicles.map((vehicle) => (
                                                <option key={vehicle.id} value={vehicle.id}>{vehicle.name} - {vehicle.plate_number}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <Label>{t('Driver')}</Label>
                                        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={assignmentForm.driver_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, driver_id: event.target.value })} required>
                                            <option value="">{t('Select driver')}</option>
                                            {drivers.map((driver) => (
                                                <option key={driver.id} value={driver.id}>{driver.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <Label>{t('Starts At')}</Label>
                                            <Input type="datetime-local" value={assignmentForm.starts_at} onChange={(event) => setAssignmentForm({ ...assignmentForm, starts_at: event.target.value })} />
                                        </div>
                                        <div>
                                            <Label>{t('Ends At')}</Label>
                                            <Input type="datetime-local" value={assignmentForm.ends_at} onChange={(event) => setAssignmentForm({ ...assignmentForm, ends_at: event.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>{t('Notes')}</Label>
                                        <Textarea value={assignmentForm.notes} onChange={(event) => setAssignmentForm({ ...assignmentForm, notes: event.target.value })} />
                                    </div>
                                    <Button type="submit">
                                        <ClipboardCheck className="mr-2 h-4 w-4" />
                                        {t('Save Assignment')}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 shadow-sm">
                            <CardContent className="grid gap-3 p-4">
                                <div className="flex items-start gap-3 rounded-lg border p-3">
                                    <KeyRound className="mt-0.5 h-5 w-5 text-sky-700" />
                                    <div>
                                        <p className="font-medium">{t('Device token is the private key for GPS hardware.')}</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('Keep it unique per vehicle. Hardware posts location to the device endpoint with this token.')}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 rounded-lg border p-3">
                                    <Radio className="mt-0.5 h-5 w-5 text-emerald-700" />
                                    <div>
                                        <p className="font-medium">{t('Mobile GPS stays the main v1 source.')}</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('Drivers still start and stop work tracking from the mobile page.')}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card className="border-border/70 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl">{t('Vehicle Registry')}</CardTitle>
                        <CardDescription>{t('Current vehicles, driver links, device configuration, and latest tracking status.')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[360px] rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-muted">
                                    <tr className="border-b text-left">
                                        <th className="p-3">{t('Vehicle')}</th>
                                        <th className="p-3">{t('Device')}</th>
                                        <th className="p-3">{t('Driver')}</th>
                                        <th className="p-3">{t('Status')}</th>
                                        <th className="p-3">{t('Last Ping')}</th>
                                        <th className="p-3 text-right">{t('Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vehicles.map((vehicle) => (
                                        <tr key={vehicle.id} className="border-b last:border-0">
                                            <td className="p-3">
                                                <div className="font-medium">{vehicle.name}</div>
                                                <div className="text-xs text-muted-foreground">{vehicle.plate_number}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium">{vehicle.gps_device_name || t('Mobile GPS')}</div>
                                                <div className="text-xs text-muted-foreground">{vehicle.has_device_token ? t('Device token configured') : t('No device token')}</div>
                                            </td>
                                            <td className="p-3">{vehicle.driver?.name || t('Unassigned')}</td>
                                            <td className="p-3">
                                                <Badge variant="outline" className={statusBadge(vehicle.tracking_status)}>
                                                    {t(vehicle.tracking_status)}
                                                </Badge>
                                            </td>
                                            <td className="p-3">{vehicle.last_ping_at ? formatDateTime(vehicle.last_ping_at) : t('No ping yet')}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => editVehicle(vehicle)}>{t('Edit')}</Button>
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={route('fleet-tracking.vehicles.show', vehicle.id)}>{t('Open')}</Link>
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {vehicles.length === 0 && (
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
