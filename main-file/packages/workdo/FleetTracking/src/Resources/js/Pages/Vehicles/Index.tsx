import { FormEvent, useMemo, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import {
    Cable,
    Check,
    ClipboardCheck,
    Copy,
    KeyRound,
    Pencil,
    Plus,
    Radio,
    Search,
    Trash2,
    TriangleAlert,
    Truck,
    UserRound,
} from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GenerateCode } from '@/components/ui/generate-code';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { EmptyState, KpiCard, KpiRow, ScrollX, SectionCard, StatusBadge } from '@/components/ui/page-kit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/helpers';
import { TraccarDevicePicker } from '../../Components/TraccarDevicePicker';
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

type ActiveAssignment = {
    id: number;
    vehicle_id: number;
    driver_id: number;
    status: string;
    starts_at?: string | null;
    ends_at?: string | null;
    notes?: string | null;
    driver?: Driver | null;
};

type SettingsVehicle = FleetMapVehicle & {
    active_assignment?: ActiveAssignment | null;
};

type Props = {
    vehicles: SettingsVehicle[];
    drivers: Driver[];
    summary: {
        total: number;
        online: number;
        stale: number;
        offline: number;
    };
    can: {
        manage_vehicles: boolean;
        manage_fleet: boolean;
    };
};

type VehicleFormData = {
    name: string;
    plate_number: string;
    vehicle_type: string;
    status: string;
    gps_device_token: string;
    gps_device_name: string;
    traccar_unique_id: string;
    airtag_reference: string;
    notes: string;
};

const TRACKING_TONES: Record<string, 'green' | 'orange' | 'gray'> = {
    online: 'green',
    stale: 'orange',
};

const DEVICE_PING_EXAMPLE = `{
    "device_token": "YOUR-VEHICLE-TOKEN",
    "latitude": 24.7136,
    "longitude": 46.6753,
    "speed": 42.5,
    "heading": 180,
    "battery": 76,
    "recorded_at": "2026-08-08T10:00:00Z"
}`;

/**
 * Create and edit share one dialog. `vehicle` null means create; on edit the
 * token field starts blank because the backend keeps the stored token when it
 * receives an empty one.
 */
function VehicleDialog({ vehicle, onClose }: { vehicle: SettingsVehicle | null; onClose: () => void }) {
    const { t } = useTranslation();
    const isEdit = !!vehicle;
    const form = useForm<VehicleFormData>({
        name: vehicle?.name ?? '',
        plate_number: vehicle?.plate_number ?? '',
        vehicle_type: vehicle?.vehicle_type || 'van',
        status: vehicle?.status || 'active',
        gps_device_token: '',
        gps_device_name: vehicle?.gps_device_name || '',
        traccar_unique_id: vehicle?.traccar_unique_id || '',
        airtag_reference: vehicle?.airtag_reference || '',
        notes: vehicle?.notes || '',
    });

    const traccarId = form.data.traccar_unique_id.trim();

    // Traccar allows any string as a uniqueId; hardware trackers just happen to
    // use a 15-digit IMEI. So this drives a warning, never a blocked submit.
    const traccarIdLooksOdd = traccarId.length > 0 && !/^\d{15}$/.test(traccarId);

    /**
     * Whether the linked Traccar device has actually reported yet.
     *
     * A mistyped id fails silently otherwise - positions are rejected server
     * side and the vehicle simply never moves, with nothing on screen to say why.
     */
    const traccarStatus = (() => {
        if (!isEdit || !vehicle?.traccar_unique_id) return null;

        if (vehicle.last_source === 'traccar' && vehicle.last_ping_at) {
            return { ok: true, label: `${t('Last reported')} ${formatDateTime(vehicle.last_ping_at)}` };
        }

        return { ok: false, label: t('No position received from Traccar yet. Check the device ID and that forwarding is enabled.') };
    })();

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };

        if (vehicle) {
            form.put(route('fleet-tracking.vehicles.update', vehicle.id), options);
        } else {
            form.post(route('fleet-tracking.vehicles.store'), options);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEdit ? t('Update Vehicle or Device') : t('Add Vehicle or Tracking Device')}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? `${vehicle!.name} - ${vehicle!.plate_number}`
                            : t('Vehicle types match Traccar categories, so the vehicle keeps its icon there.')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                    <div>
                        <Label>{t('Vehicle Name')}</Label>
                        <Input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                        <InputError message={form.errors.name} className="mt-1" />
                    </div>
                    <div>
                        <Label>{t('Plate Number')}</Label>
                        <Input
                            value={form.data.plate_number}
                            onChange={(event) => form.setData('plate_number', event.target.value)}
                            required
                        />
                        <InputError message={form.errors.plate_number} className="mt-1" />
                    </div>
                    {/* The three sources are alternatives, not a checklist. Left
                        flat in the form they read as fields you must all fill in,
                        which is the main thing people got wrong here. */}
                    <div className="md:col-span-2 rounded-lg border p-4">
                        <p className="text-sm font-medium">{t('How is this vehicle tracked?')}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t('Pick the tracker fitted to this vehicle, then enter the ID Traccar knows it by.')}
                        </p>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Label>{t('Tracker Model')}</Label>
                                <TraccarDevicePicker
                                    value={form.data.gps_device_name}
                                    onChange={(model) => form.setData('gps_device_name', model)}
                                />
                                <InputError message={form.errors.gps_device_name} className="mt-1" />
                            </div>

                            <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-500/30 dark:bg-blue-500/5">
                                <Label>{t('Traccar Device ID')}</Label>
                                <Input
                                    dir="ltr"
                                    className="font-mono"
                                    value={form.data.traccar_unique_id}
                                    onChange={(event) => form.setData('traccar_unique_id', event.target.value)}
                                    placeholder="860123456789012"
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t('Must match the device identifier in Traccar exactly, usually the IMEI.')}
                                </p>

                                {/* Traccar accepts any string as a uniqueId, so this
                                    warns rather than blocks - an OsmAnd phone client
                                    legitimately uses a non-IMEI id. */}
                                {traccarIdLooksOdd && (
                                    <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        {t('This is not a 15-digit IMEI. That is fine for phone trackers, but check it if you are using GPS hardware.')}
                                    </p>
                                )}

                                {isEdit && traccarStatus && (
                                    <p className={cn(
                                        'mt-2 flex items-start gap-1.5 text-xs',
                                        traccarStatus.ok
                                            ? 'text-green-700 dark:text-green-400'
                                            : 'text-amber-700 dark:text-amber-400'
                                    )}>
                                        {traccarStatus.ok
                                            ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                        {traccarStatus.label}
                                    </p>
                                )}

                                <InputError message={form.errors.traccar_unique_id} className="mt-1" />
                            </div>


                            {/* The direct-post token is a second, parallel way in
                                that Traccar makes unnecessary. Kept - the
                                device-pings endpoint still uses it - but folded
                                away so the default form is Traccar only. */}
                            <div className="md:col-span-2">
                                <Collapsible defaultOpen={isEdit && vehicle!.has_device_token}>
                                    <CollapsibleTrigger className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                                        {t('Not using Traccar? Post to us directly')}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="mt-2">
                                            <Label>{isEdit ? t('Replace GPS Device Token') : t('GPS Device Token')}</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    value={form.data.gps_device_token}
                                                    onChange={(event) => form.setData('gps_device_token', event.target.value)}
                                                    placeholder={t('Paste or generate a token')}
                                                />
                                                <GenerateCode length={16} onGenerate={(code) => form.setData('gps_device_token', code)} />
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {t('Only for hardware posting straight to us, without Traccar.')}
                                            </p>
                                            {isEdit && vehicle!.has_device_token && (
                                                <p className="mt-1 text-xs text-muted-foreground">{t('Leave token empty to keep current token.')}</p>
                                            )}
                                            <InputError message={form.errors.gps_device_token} className="mt-1" />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        </div>
                    </div>
                    {/* Everything that is not needed to start tracking. Open
                        by default when editing, where you came to change one
                        of these; folded away when adding, where the defaults
                        are almost always right. */}
                    <div className="md:col-span-2">
                        <Collapsible defaultOpen={isEdit}>
                            <CollapsibleTrigger className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                                {t('More options')}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="mt-3 grid gap-4 md:grid-cols-2">
                                    <div>
                                        <Label>{t('Vehicle Type')}</Label>
                                        <Select value={form.data.vehicle_type} onValueChange={(value) => form.setData('vehicle_type', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('Vehicle Type')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Values match Traccar's own device categories, so a
                                                    vehicle reads the same in both systems and keeps
                                                    its icon there. "other" is the one exception, kept
                                                    because existing rows already use it. */}
                                                <SelectItem value="van">{t('Van')}</SelectItem>
                                                <SelectItem value="truck">{t('Truck')}</SelectItem>
                                                <SelectItem value="car">{t('Car')}</SelectItem>
                                                <SelectItem value="pickup">{t('Pickup')}</SelectItem>
                                                <SelectItem value="bus">{t('Bus')}</SelectItem>
                                                <SelectItem value="motorcycle">{t('Motorcycle')}</SelectItem>
                                                <SelectItem value="scooter">{t('Scooter')}</SelectItem>
                                                <SelectItem value="tractor">{t('Tractor')}</SelectItem>
                                                <SelectItem value="other">{t('Other')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={form.errors.vehicle_type} className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>{t('Vehicle Status')}</Label>
                                        <Select value={form.data.status} onValueChange={(value) => form.setData('status', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('Vehicle Status')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">{t('Active')}</SelectItem>
                                                <SelectItem value="maintenance">{t('Maintenance')}</SelectItem>
                                                <SelectItem value="inactive">{t('Inactive')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={form.errors.status} className="mt-1" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label>{t('Notes')}</Label>
                                        <Textarea value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                                        <InputError message={form.errors.notes} className="mt-1" />
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>

                    <DialogFooter className="md:col-span-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {isEdit ? <ClipboardCheck className="me-2 h-4 w-4" /> : <Plus className="me-2 h-4 w-4" />}
                            {form.processing ? t('Saving...') : isEdit ? t('Save Vehicle') : t('Create Vehicle')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AssignmentDialog({
    vehicles,
    drivers,
    presetVehicleId,
    onClose,
}: {
    vehicles: SettingsVehicle[];
    drivers: Driver[];
    presetVehicleId?: number;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const form = useForm({
        vehicle_id: presetVehicleId ? String(presetVehicleId) : '',
        driver_id: '',
        starts_at: '',
        ends_at: '',
        notes: '',
    });

    // Warn before the backend silently completes a conflicting active assignment.
    const vehicleConflict = useMemo(
        () => vehicles.find((item) => String(item.id) === form.data.vehicle_id)?.active_assignment ?? null,
        [form.data.vehicle_id, vehicles],
    );

    const driverConflict = useMemo(() => {
        const driverId = Number(form.data.driver_id);
        if (!driverId) return null;
        return (
            vehicles.find(
                (vehicle) => vehicle.active_assignment?.driver_id === driverId && String(vehicle.id) !== form.data.vehicle_id,
            ) ?? null
        );
    }, [form.data.driver_id, form.data.vehicle_id, vehicles]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('fleet-tracking.assignments.store'), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('Assign Driver')}</DialogTitle>
                    <DialogDescription>{t('Connect a driver to a vehicle before mobile work tracking starts.')}</DialogDescription>
                </DialogHeader>

                <form onSubmit={submit} className="grid gap-4">
                    <div>
                        <Label>{t('Vehicle')}</Label>
                        <Select value={form.data.vehicle_id} onValueChange={(value) => form.setData('vehicle_id', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('Select vehicle')} />
                            </SelectTrigger>
                            <SelectContent>
                                {vehicles.map((vehicle) => (
                                    <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                                        {vehicle.name} - {vehicle.plate_number}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.vehicle_id} className="mt-1" />
                    </div>
                    <div>
                        <Label>{t('Driver')}</Label>
                        <Select value={form.data.driver_id} onValueChange={(value) => form.setData('driver_id', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('Select driver')} />
                            </SelectTrigger>
                            <SelectContent>
                                {drivers.map((driver) => (
                                    <SelectItem key={driver.id} value={String(driver.id)}>
                                        {driver.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.driver_id} className="mt-1" />
                    </div>

                    {(vehicleConflict || driverConflict) && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="space-y-1">
                                {vehicleConflict && <p>{t('This vehicle already has an active assignment. Saving will end it.')}</p>}
                                {driverConflict && (
                                    <p>{t('This driver is already assigned to another vehicle. Saving will end that assignment.')}</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label>{t('Starts At')}</Label>
                            <Input
                                type="datetime-local"
                                value={form.data.starts_at}
                                onChange={(event) => form.setData('starts_at', event.target.value)}
                            />
                            <InputError message={form.errors.starts_at} className="mt-1" />
                        </div>
                        <div>
                            <Label>{t('Ends At')}</Label>
                            <Input
                                type="datetime-local"
                                value={form.data.ends_at}
                                onChange={(event) => form.setData('ends_at', event.target.value)}
                            />
                            <InputError message={form.errors.ends_at} className="mt-1" />
                        </div>
                    </div>
                    <div>
                        <Label>{t('Notes')}</Label>
                        <Textarea value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                        <InputError message={form.errors.notes} className="mt-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('A vehicle or driver can hold one active assignment; saving replaces the previous one.')}
                    </p>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            <ClipboardCheck className="me-2 h-4 w-4" />
                            {form.processing ? t('Saving...') : t('Save Assignment')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function SettingsPage() {
    const { t } = useTranslation();
    const { vehicles, drivers, summary, can } = usePage<Props>().props;

    // null = closed, 'create' = new vehicle, otherwise the vehicle being edited.
    const [vehicleDialog, setVehicleDialog] = useState<'create' | SettingsVehicle | null>(null);
    const [assignmentDialog, setAssignmentDialog] = useState<{ vehicleId?: number } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SettingsVehicle | null>(null);
    const [endTarget, setEndTarget] = useState<ActiveAssignment | null>(null);
    const [search, setSearch] = useState('');

    const deviceReadyVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.has_device_token).length, [vehicles]);
    const activeAssignments = useMemo(
        () =>
            vehicles.filter(
                (vehicle): vehicle is SettingsVehicle & { active_assignment: ActiveAssignment } => !!vehicle.active_assignment,
            ),
        [vehicles],
    );

    const filteredVehicles = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return vehicles;
        return vehicles.filter((vehicle) =>
            [vehicle.name, vehicle.plate_number, vehicle.driver?.name, vehicle.gps_device_name]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term)),
        );
    }, [search, vehicles]);

    const trackingLabel = (status: string) =>
        ({ online: t('Online'), stale: t('Stale'), offline: t('Offline') })[status] ?? status;

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(route('fleet-tracking.vehicles.destroy', deleteTarget.id), {
            preserveScroll: true,
            onFinish: () => setDeleteTarget(null),
        });
    };

    const confirmEndAssignment = () => {
        if (!endTarget) return;
        router.put(route('fleet-tracking.assignments.end', endTarget.id), {}, {
            preserveScroll: true,
            onFinish: () => setEndTarget(null),
        });
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Vehicles') },
            ]}
            pageTitle={t('Vehicles')}
            pageActions={(
                <div className="flex flex-wrap items-center gap-2">
                    {/* Intake configuration lives on its own page now; this is
                        the only link to it, so it stays even when the map is
                        hidden from the sidebar. */}
                    {can.manage_fleet && (
                        <Button asChild variant="outline" size="sm">
                            <Link href={route('fleet-tracking.settings')}>
                                <Cable className="me-2 h-4 w-4" />
                                {t('Intake Settings')}
                            </Link>
                        </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setAssignmentDialog({})}>
                        <UserRound className="me-2 h-4 w-4" />
                        {t('Assign Driver')}
                    </Button>
                    {can.manage_vehicles && (
                        <Button type="button" size="sm" onClick={() => setVehicleDialog('create')}>
                            <Plus className="me-2 h-4 w-4" />
                            {t('Add Vehicle')}
                        </Button>
                    )}
                </div>
            )}
        >
            <Head title={t('Vehicles')} />

            <div className="mx-auto max-w-7xl space-y-6">
                <KpiRow cols={4}>
                    <KpiCard label={t('Vehicles')} value={summary.total} icon={<Truck className="h-5 w-5" />} tone="gray" />
                    <KpiCard
                        label={t('Configured Devices')}
                        value={deviceReadyVehicles}
                        icon={<Cable className="h-5 w-5" />}
                        tone="blue"
                    />
                    <KpiCard
                        label={t('Assigned Vehicles')}
                        value={activeAssignments.length}
                        icon={<UserRound className="h-5 w-5" />}
                        tone="green"
                    />
                    <KpiCard label={t('Offline')} value={summary.offline} icon={<Radio className="h-5 w-5" />} tone="red" />
                </KpiRow>

                <div className="grid gap-6">
                    <SectionCard
                        title={t('Active Assignments')}
                        actions={(
                            <Button type="button" variant="outline" size="sm" onClick={() => setAssignmentDialog({})}>
                                <Plus className="me-2 h-4 w-4" />
                                {t('Assign Driver')}
                            </Button>
                        )}
                    >
                        {activeAssignments.length === 0 ? (
                            <EmptyState icon={<UserRound className="h-8 w-8" />} title={t('No active assignments yet.')} />
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                                {activeAssignments.map((vehicle) => (
                                    <li
                                        key={vehicle.active_assignment.id}
                                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {vehicle.active_assignment.driver?.name || vehicle.driver?.name || t('Unassigned')}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {vehicle.name} - {vehicle.plate_number}
                                                {vehicle.active_assignment.starts_at && (
                                                    <> · {formatDateTime(vehicle.active_assignment.starts_at)}</>
                                                )}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEndTarget(vehicle.active_assignment)}
                                        >
                                            {t('End')}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>

                </div>

                <SectionCard
                    title={t('Vehicle Registry')}
                    description={t('Current vehicles, driver links, device configuration, and latest tracking status.')}
                    actions={(
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder={t('Search vehicles')}
                                    className="w-56 ps-9"
                                />
                            </div>
                            {can.manage_vehicles && (
                                <Button type="button" size="sm" onClick={() => setVehicleDialog('create')}>
                                    <Plus className="me-2 h-4 w-4" />
                                    {t('Add Vehicle')}
                                </Button>
                            )}
                        </div>
                    )}
                    flush
                >
                    {filteredVehicles.length === 0 ? (
                        <EmptyState
                            icon={<Truck className="h-8 w-8" />}
                            title={t('No vehicles found.')}
                            description={search ? undefined : t('Create your first vehicle to start fleet tracking.')}
                            action={
                                !search && can.manage_vehicles ? (
                                    <Button type="button" size="sm" onClick={() => setVehicleDialog('create')}>
                                        <Plus className="me-2 h-4 w-4" />
                                        {t('Add Vehicle')}
                                    </Button>
                                ) : undefined
                            }
                        />
                    ) : (
                        <div className="max-h-[520px] overflow-y-auto">
                            <ScrollX>
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur dark:bg-slate-950/95">
                                        <tr className="border-b">
                                            <th className="p-3 text-start font-medium">{t('Vehicle')}</th>
                                            <th className="p-3 text-start font-medium">{t('Device')}</th>
                                            <th className="p-3 text-start font-medium">{t('Driver')}</th>
                                            <th className="p-3 text-start font-medium">{t('Status')}</th>
                                            <th className="p-3 text-start font-medium">{t('Last Ping')}</th>
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
                                                    <div className="font-medium">{vehicle.gps_device_name || t('Mobile GPS')}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {vehicle.has_device_token ? t('Device token configured') : t('No device token')}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    {vehicle.driver?.name ? (
                                                        vehicle.driver.name
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-auto p-0 text-muted-foreground hover:bg-transparent hover:underline"
                                                            onClick={() => setAssignmentDialog({ vehicleId: vehicle.id })}
                                                        >
                                                            {t('Unassigned')}
                                                        </Button>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <StatusBadge tone={TRACKING_TONES[vehicle.tracking_status] ?? 'gray'}>
                                                        {trackingLabel(vehicle.tracking_status)}
                                                    </StatusBadge>
                                                </td>
                                                <td className="p-3">
                                                    {vehicle.last_ping_at ? formatDateTime(vehicle.last_ping_at) : t('No ping yet')}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex justify-end gap-2">
                                                        {can.manage_vehicles && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setVehicleDialog(vehicle)}
                                                            >
                                                                <Pencil className="me-1.5 h-3.5 w-3.5" />
                                                                {t('Edit')}
                                                            </Button>
                                                        )}
                                                        <Button asChild variant="outline" size="sm">
                                                            <Link href={route('fleet-tracking.vehicles.show', vehicle.id)}>
                                                                {t('Open')}
                                                            </Link>
                                                        </Button>
                                                        {can.manage_vehicles && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={() => setDeleteTarget(vehicle)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ScrollX>
                        </div>
                    )}
                </SectionCard>
            </div>

            {vehicleDialog && (
                <VehicleDialog
                    vehicle={vehicleDialog === 'create' ? null : vehicleDialog}
                    onClose={() => setVehicleDialog(null)}
                />
            )}

            {assignmentDialog && (
                <AssignmentDialog
                    vehicles={vehicles}
                    drivers={drivers}
                    presetVehicleId={assignmentDialog.vehicleId}
                    onClose={() => setAssignmentDialog(null)}
                />
            )}

            <ConfirmationDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                variant="destructive"
                title={t('Delete Vehicle')}
                message={t('Deleting a vehicle permanently removes its assignments, sessions, and location history. This cannot be undone.')}
                confirmText={t('Delete')}
                onConfirm={confirmDelete}
            />

            <ConfirmationDialog
                open={!!endTarget}
                onOpenChange={(open) => !open && setEndTarget(null)}
                title={t('End Assignment')}
                message={t('End this assignment now? The driver will no longer be linked to the vehicle.')}
                confirmText={t('End')}
                onConfirm={confirmEndAssignment}
            />
        </AuthenticatedLayout>
    );
}
