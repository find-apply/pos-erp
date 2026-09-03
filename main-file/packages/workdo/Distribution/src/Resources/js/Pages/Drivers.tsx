import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { ArrowUpDown, Clock, Key, LogIn, MapPin, MoreVertical, Package, PackageCheck, PackageMinus, PackagePlus, Pencil, Plus, RefreshCw, Search, Target, Trash2, Truck, Wallet } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { EmptyState, KpiCard, KpiRow } from '@/components/ui/page-kit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/utils/helpers';
import { LoadVanDialog } from '../Components/LoadVanDialog';

declare global {
    function route(name: string, params?: any): string;
}

type DriverCard = {
    id: number;
    name: string;
    code: string;
    phone: string | null;
    vehicle_label: string | null;
    access_code: string;
    allow_credit: boolean;
    max_discount_type: string;
    max_discount_value: number;
    cash_balance: number;
    status: string;
    vehicle_id: number | null;
    total: number;
    delivered: number;
    pending: number;
    failed: number;
    collected: number;
    success_rate: number;
    last_latitude: number | null;
    last_longitude: number | null;
    last_position_at: string | null;
    last_app_opened_at: string | null;
};

type Option = { id: number; name: string };

type Props = {
    drivers: DriverCard[];
    next_code: string;
    next_access_code: string;
    warehouses: Option[];
    products: Array<Option & { sku: string | null }>;
    vehicles: Array<Option & { plate_number: string | null }>;
};

type DriverForm = {
    name: string;
    code: string;
    phone: string;
    vehicle_label: string;
    access_code: string;
    allow_credit: boolean;
    max_discount_type: string;
    max_discount_value: number;
    status: string;
};

/** Sign-in link for a code. Ziggy already yields an absolute URL, which is
 *  what a phone camera needs in order to resolve the scan. */
const accessUrl = (code: string) => `${route('distribution.driver.access')}?c=${code}`;

const rateTone = (rate: number): 'green' | 'orange' | 'red' => (rate >= 80 ? 'green' : rate >= 50 ? 'orange' : 'red');

const formatDateTime = (value: string | null) => {
    if (!value) return '-';

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
};

const mapUrl = (latitude: number, longitude: number) => `https://www.google.com/maps?q=${latitude},${longitude}`;

/** Six random digits, matching what the backend would otherwise generate. */
const randomAccessCode = () => String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');

/**
 * The QR encodes the driver sign-in URL with the access code prefilled, so
 * scanning it on a phone lands on the login screen ready for the driver's
 * phone number. Encoding the bare digits would give a scanner nothing to open.
 */
function AccessQr({ value, url, label }: { value: string; url: string; label: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, url, { width: 96, margin: 1 }).catch(() => {
            // A failed render just leaves the canvas blank - the code is shown
            // as text next to it either way.
        });
    }, [url]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title={label}
                className="rounded-lg border bg-white p-2 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-100"
            >
                <canvas ref={canvasRef} style={{ height: 48, width: 48 }} role="img" aria-label={label} />
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-xs">
                    <DialogHeader>
                        <DialogTitle>{label}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-3 py-2">
                        <div className="rounded-lg bg-white p-3">
                            <QrLarge value={url} />
                        </div>
                        <p className="font-mono text-2xl tracking-widest">{value}</p>
                        <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function QrLarge({ value }: { value: string }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (ref.current) {
            QRCode.toCanvas(ref.current, value, { width: 200, margin: 1 }).catch(() => {});
        }
    }, [value]);

    return <canvas ref={ref} role="img" />;
}


/** Hand the driver's collected cash in to the office. */
function SettleDialog({ driver, onClose }: { driver: DriverCard; onClose: () => void }) {
    const { t } = useTranslation();
    const form = useForm({ amount: driver.cash_balance });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('distribution.drivers.settle', driver.id), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{t('Settle cash')}</DialogTitle>
                        <DialogDescription>
                            {driver.name} - {formatCurrency(driver.cash_balance)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2 py-4">
                        <Label htmlFor="amount">{t('Amount received')}</Label>
                        <Input
                            id="amount"
                            type="number"
                            min={0}
                            max={driver.cash_balance}
                            step="0.01"
                            value={form.data.amount}
                            onChange={(event) => form.setData('amount', Number(event.target.value))}
                        />
                        <InputError message={form.errors.amount} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing || form.data.amount <= 0}>
                            {t('Settle')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DriverDialog({
    driver,
    nextCode,
    nextAccessCode,
    vehicles,
    onClose,
}: {
    driver: DriverCard | null;
    nextCode: string;
    nextAccessCode: string;
    vehicles: Array<{ id: number; name: string; plate_number: string | null }>;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const isEdit = !!driver;

    const form = useForm<DriverForm>({
        name: driver?.name ?? '',
        code: driver?.code ?? '',
        phone: driver?.phone ?? '',
        vehicle_label: driver?.vehicle_label ?? '',
        access_code: driver?.access_code ?? nextAccessCode,
        allow_credit: driver?.allow_credit ?? true,
        max_discount_type: driver?.max_discount_type ?? 'percent',
        max_discount_value: driver?.max_discount_value ?? 0,
        status: driver?.status ?? 'active',
        vehicle_id: driver?.vehicle_id ? String(driver.vehicle_id) : '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const options = { preserveScroll: true, onSuccess: () => onClose() };

        // An empty select posts as "", which would fail integer validation.
        form.transform((data) => ({ ...data, vehicle_id: data.vehicle_id || null }));

        if (isEdit) {
            form.put(route('distribution.drivers.update', driver!.id), options);
        } else {
            form.post(route('distribution.drivers.store'), options);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? t('Edit driver') : t('New driver')}</DialogTitle>
                        <DialogDescription>
                            {isEdit ? t('Update this driver') : t('A driver will be created with their own cash box')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">{t('Driver name')} *</Label>
                            <Input
                                id="name"
                                value={form.data.name}
                                onChange={(event) => form.setData('name', event.target.value)}
                                placeholder={t('Driver name')}
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="code">{t('Driver code')}</Label>
                                <Input
                                    id="code"
                                    value={form.data.code}
                                    onChange={(event) => form.setData('code', event.target.value)}
                                    placeholder={isEdit ? '' : nextCode}
                                    disabled={isEdit}
                                />
                                <InputError message={form.errors.code} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">{t('Phone')} *</Label>
                                <Input
                                    id="phone"
                                    value={form.data.phone}
                                    onChange={(event) => form.setData('phone', event.target.value)}
                                    placeholder="0555 XX XX XX"
                                />
                                <InputError message={form.errors.phone} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="vehicle">{t('Vehicle')}</Label>
                            <Input
                                id="vehicle"
                                value={form.data.vehicle_label}
                                onChange={(event) => form.setData('vehicle_label', event.target.value)}
                                placeholder={t('Make and plate number')}
                            />
                            <InputError message={form.errors.vehicle_label} />
                        </div>

                        <div className="grid gap-2">
                            <Label>{t('Fleet vehicle')}</Label>
                            <Select
                                value={form.data.vehicle_id}
                                onValueChange={(v) => form.setData('vehicle_id', v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('None')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles.map((v) => (
                                        <SelectItem key={v.id} value={String(v.id)}>
                                            {v.name}{v.plate_number ? ` — ${v.plate_number}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.vehicle_id} />
                            <p className="text-xs text-muted-foreground">
                                {t('Required for GPS tracking - location is recorded against the vehicle')}
                            </p>
                        </div>

                        <div className="mt-2 border-t pt-4">
                            <Label className="mb-3 flex items-center gap-2 text-base font-medium">
                                <Key className="h-4 w-4" />
                                {t('Mobile login')}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="access_code"
                                    className="font-mono text-lg tracking-widest"
                                    maxLength={6}
                                    value={form.data.access_code}
                                    onChange={(event) => form.setData('access_code', event.target.value.replace(/\D/g, ''))}
                                    placeholder="123456"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title={t('Generate a new code')}
                                    onClick={() => form.setData('access_code', randomAccessCode())}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                            <InputError message={form.errors.access_code} />
                            <p className="mt-2 text-xs text-muted-foreground">
                                {t('The driver signs in to the mobile app with their phone number and this code')}
                            </p>
                        </div>

                        <div className="flex items-center justify-between border-t pt-4">
                            <Label htmlFor="credit">{t('Allow credit sales')}</Label>
                            <Switch
                                id="credit"
                                checked={form.data.allow_credit}
                                onCheckedChange={(checked) => form.setData('allow_credit', checked)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>{t('Maximum allowed discount')}</Label>
                            <div className="flex gap-4">
                                {[
                                    { value: 'percent', label: t('Percentage (%)') },
                                    { value: 'amount', label: t('Amount') },
                                ].map((option) => (
                                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            name="discount-type"
                                            value={option.value}
                                            checked={form.data.max_discount_type === option.value}
                                            onChange={() => form.setData('max_discount_type', option.value)}
                                        />
                                        {option.label}
                                    </label>
                                ))}
                            </div>
                            <Input
                                id="discount"
                                type="number"
                                min={0}
                                max={form.data.max_discount_type === 'percent' ? 100 : undefined}
                                value={form.data.max_discount_value}
                                onChange={(event) => form.setData('max_discount_value', Number(event.target.value))}
                            />
                            <InputError message={form.errors.max_discount_value} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing || !form.data.name || !form.data.phone}>
                            {isEdit ? t('Save') : t('Create driver')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function Drivers() {
    const { t } = useTranslation();
    const {
        drivers,
        next_code: nextCode,
        next_access_code: nextAccessCode,
        warehouses,
        products,
        vehicles,
    } = usePage<Props>().props;

    const [search, setSearch] = useState('');
    const [dialogFor, setDialogFor] = useState<DriverCard | null | undefined>(undefined);
    const [deleting, setDeleting] = useState<DriverCard | null>(null);
    const [settling, setSettling] = useState<DriverCard | null>(null);
    const [sort, setSort] = useState('name');
    const [vanFor, setVanFor] = useState<{ driver: DriverCard; mode: 'load' | 'unload' } | null>(null);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        const matched = !term
            ? drivers
            : drivers.filter(
                  (driver) =>
                      driver.name.toLowerCase().includes(term)
                      || driver.code.toLowerCase().includes(term)
                      || (driver.phone ?? '').toLowerCase().includes(term)
                      || (driver.vehicle_label ?? '').toLowerCase().includes(term)
              );

        // Descending for the numeric sorts: the point of sorting by cash or
        // pending work is to bring what needs attention to the top.
        const comparators: Record<string, (a: DriverCard, b: DriverCard) => number> = {
            name: (a, b) => a.name.localeCompare(b.name),
            cash: (a, b) => b.cash_balance - a.cash_balance,
            pending: (a, b) => b.pending - a.pending,
            success: (a, b) => b.success_rate - a.success_rate,
        };

        return [...matched].sort(comparators[sort] ?? comparators.name);
    }, [drivers, search, sort]);

    const totals = useMemo(
        () => ({
            drivers: drivers.length,
            cash: drivers.reduce((sum, driver) => sum + driver.cash_balance, 0),
            holdingCash: drivers.filter((driver) => driver.cash_balance > 0).length,
            pending: drivers.reduce((sum, driver) => sum + driver.pending, 0),
            successRate: (() => {
                // Weighted across all deliveries rather than an average of
                // averages, so one driver with a single job cannot swing it.
                const total = drivers.reduce((sum, driver) => sum + driver.total, 0);
                const delivered = drivers.reduce((sum, driver) => sum + driver.delivered, 0);
                return total > 0 ? Math.round((delivered / total) * 100) : 0;
            })(),
        }),
        [drivers]
    );

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Distribution'), url: route('distribution.index') }, { label: t('Drivers') }]}
            pageTitle={t('Drivers')}
            pageActions={(
                <Button onClick={() => setDialogFor(null)}>
                    <Plus className="me-2 h-4 w-4" />
                    {t('New driver')}
                </Button>
            )}
        >
            <Head title={t('Drivers')} />

            <div className="mx-auto max-w-7xl space-y-6">
                <p className="-mt-2 text-muted-foreground">{t('Manage your drivers')}</p>

                <KpiRow cols={4}>
                    <KpiCard label={t('Drivers')} value={totals.drivers} icon={<Truck className="h-5 w-5" />} tone="gray" />
                    <KpiCard
                        label={t('Cash to settle')}
                        value={formatCurrency(totals.cash)}
                        icon={<Wallet className="h-5 w-5" />}
                        tone={totals.cash > 0 ? 'orange' : 'green'}
                        hint={totals.holdingCash > 0 ? `${totals.holdingCash} ${t('drivers holding cash')}` : undefined}
                    />
                    <KpiCard label={t('Pending')} value={totals.pending} icon={<PackageCheck className="h-5 w-5" />} tone="blue" />
                    <KpiCard
                        label={t('Success Rate')}
                        value={`${totals.successRate}%`}
                        icon={<Target className="h-5 w-5" />}
                        tone={rateTone(totals.successRate)}
                    />
                </KpiRow>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative max-w-sm flex-1">
                        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="ps-9"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('Search for a driver...')}
                        />
                    </div>

                    <Select value={sort} onValueChange={setSort}>
                        <SelectTrigger className="w-[190px]">
                            <ArrowUpDown className="me-2 h-4 w-4 shrink-0" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">{t('Name')}</SelectItem>
                            <SelectItem value="cash">{t('Cash box')}</SelectItem>
                            <SelectItem value="pending">{t('Pending')}</SelectItem>
                            <SelectItem value="success">{t('Success Rate')}</SelectItem>
                        </SelectContent>
                    </Select>

                    {search && (
                        <span className="text-sm text-muted-foreground">
                            {filtered.length} / {drivers.length}
                        </span>
                    )}
                </div>

                {filtered.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 dark:border-slate-800">
                        <EmptyState
                            icon={<Truck className="h-8 w-8" />}
                            title={drivers.length === 0 ? t('No driver') : t('No driver matches this search')}
                            description={drivers.length === 0 ? t('Create your first driver to get started') : undefined}
                            action={drivers.length === 0 ? (
                                <Button onClick={() => setDialogFor(null)}>
                                    <Plus className="me-2 h-4 w-4" />
                                    {t('Create a driver')}
                                </Button>
                            ) : undefined}
                        />
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((driver) => (
                            <Card
                                key={driver.id}
                                className={cn(
                                    'transition-colors',
                                    // Holding cash is the one thing on this
                                    // screen that needs acting on, so it is
                                    // visible without reading the figures.
                                    driver.cash_balance > 0 && 'ring-1 ring-amber-300 dark:ring-amber-500/30',
                                    driver.status !== 'active' && 'opacity-60'
                                )}
                            >
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                            <Truck className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="truncate text-base font-semibold tracking-tight">{driver.name}</h3>
                                            <p className="text-sm text-muted-foreground">{driver.code}</p>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                disabled={driver.status !== 'active'}
                                                onClick={() =>
                                                    router.post(route('distribution.drivers.impersonate', driver.id))
                                                }
                                            >
                                                <LogIn className="me-2 h-4 w-4" />
                                                {t('Login as driver')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setVanFor({ driver, mode: 'load' })}>
                                                <PackagePlus className="me-2 h-4 w-4" />
                                                {t('Load vehicle')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setVanFor({ driver, mode: 'unload' })}>
                                                <PackageMinus className="me-2 h-4 w-4" />
                                                {t('Unload vehicle')}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => setDialogFor(driver)}>
                                                <Pencil className="me-2 h-4 w-4" />
                                                {t('Edit')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    router.put(
                                                        route('distribution.drivers.access-code', driver.id),
                                                        {},
                                                        { preserveScroll: true }
                                                    )
                                                }
                                            >
                                                <RefreshCw className="me-2 h-4 w-4" />
                                                {t('Regenerate the code')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                disabled={driver.cash_balance <= 0}
                                                onClick={() => setSettling(driver)}
                                            >
                                                <Wallet className="me-2 h-4 w-4" />
                                                {t('Settle cash')}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600"
                                                onClick={() => setDeleting(driver)}
                                            >
                                                <Trash2 className="me-2 h-4 w-4" />
                                                {t('Delete')}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>

                                <CardContent className="pt-0">
                                    <div className="mt-2 grid grid-cols-2 gap-4">
                                        <div className="flex items-center gap-2">
                                            <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">{t('Cash box')}</p>
                                                <p
                                                    className={cn(
                                                        'text-sm font-medium',
                                                        driver.cash_balance > 0 && 'text-amber-600 dark:text-amber-400'
                                                    )}
                                                >
                                                    {formatCurrency(driver.cash_balance)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">{t('Vehicle')}</p>
                                                <p className="truncate text-sm font-medium">{driver.vehicle_label || '-'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {driver.cash_balance > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-3 w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10"
                                            onClick={() => setSettling(driver)}
                                        >
                                            <Wallet className="me-2 h-4 w-4" />
                                            {t('Settle cash')}
                                        </Button>
                                    )}

                                    <div className="mt-4 space-y-3 border-t pt-4">
                                        <div className="flex items-start gap-2">
                                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">{t('Last position')}</p>
                                                {driver.last_latitude !== null && driver.last_longitude !== null ? (
                                                    <a
                                                        href={mapUrl(driver.last_latitude, driver.last_longitude)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-sm font-medium text-primary hover:underline"
                                                    >
                                                        {driver.last_latitude.toFixed(5)}, {driver.last_longitude.toFixed(5)}
                                                    </a>
                                                ) : (
                                                    <p className="text-sm font-medium">-</p>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDateTime(driver.last_position_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">{t('Last app open')}</p>
                                                <p className="text-sm font-medium">{formatDateTime(driver.last_app_opened_at)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {driver.total > 0 && (
                                        <div className="mt-4 space-y-1.5 border-t pt-4">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">
                                                    {driver.delivered} {t('delivered')} · {driver.pending} {t('pending')}
                                                    {driver.failed > 0 && ` · ${driver.failed} ${t('failed')}`}
                                                </span>
                                                <span className="font-medium tabular-nums">{driver.success_rate}%</span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                                                <div
                                                    className={cn(
                                                        'h-full rounded-full',
                                                        driver.success_rate >= 80
                                                            ? 'bg-green-500'
                                                            : driver.success_rate >= 50
                                                              ? 'bg-orange-500'
                                                              : 'bg-red-500'
                                                    )}
                                                    style={{ width: `${driver.success_rate}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 border-t pt-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">{t('Access code')}</p>
                                                    <p className="font-mono text-sm font-medium tracking-wider">
                                                        {driver.access_code}
                                                    </p>
                                                </div>
                                            </div>
                                            <AccessQr
                                                value={driver.access_code}
                                                url={accessUrl(driver.access_code)}
                                                label={t('Show QR code')}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <Badge variant={driver.status === 'active' ? 'default' : 'secondary'}>
                                            {driver.status === 'active' ? t('Active') : t('Inactive')}
                                        </Badge>
                                        {driver.phone && (
                                            <a href={`tel:${driver.phone}`} className="text-sm text-primary hover:underline">
                                                {driver.phone}
                                            </a>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {dialogFor !== undefined && (
                <DriverDialog
                    driver={dialogFor}
                    nextCode={nextCode}
                    nextAccessCode={nextAccessCode}
                    vehicles={vehicles}
                    onClose={() => setDialogFor(undefined)}
                />
            )}

            {vanFor && (
                <LoadVanDialog
                    driver={vanFor.driver}
                    mode={vanFor.mode}
                    warehouses={warehouses}
                    products={products}
                    onClose={() => setVanFor(null)}
                />
            )}

            {settling && (
                <SettleDialog driver={settling} onClose={() => setSettling(null)} />
            )}

            {deleting && (
                <ConfirmationDialog
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={t('Delete driver')}
                    message={t('This driver will be removed. Past deliveries are kept.')}
                    variant="destructive"
                    onConfirm={() => {
                        router.delete(route('distribution.drivers.destroy', deleting.id), {
                            preserveScroll: true,
                            onFinish: () => setDeleting(null),
                        });
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}
