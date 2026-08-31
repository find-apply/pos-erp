import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Building2, Filter, Map as MapIcon, MapPin, RefreshCw, Search, Truck, User, Warehouse } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/helpers';
import { noteStatusLabel } from '../lib/status';

declare global {
    function route(name: string, params?: any): string;
}

type Note = {
    id: number;
    reference: string | null;
    status: string;
    latitude: number;
    longitude: number;
    total_amount: number;
    collected_amount: number;
    round_id: number | null;
    driver: { id: number; name: string } | null;
};

type Marker = { id: number; name: string; latitude: number; longitude: number };

type Unpinned = { id: number; name: string; type: 'customer' | 'warehouse' };

type Props = {
    unpinned: Unpinned[];
    notes: Note[];
    drivers_on_map: Array<Marker & { plate_number: string; driver: { id: number; name: string } | null }>;
    customers: Marker[];
    warehouses: Marker[];
    headquarters: { latitude: number; longitude: number } | null;
    rounds: Array<{ id: number; reference: string }>;
    drivers: Array<{ id: number; name: string }>;
};

/**
 * One visual language for the map and its legend: the swatch a reader sees in
 * the legend is the marker they find on the map.
 */
const LAYERS = {
    driver: { color: '#3b82f6', glyph: '🚚', labelKey: 'Driver' },
    customer: { color: '#6b7280', glyph: '📍', labelKey: 'Customer' },
    pending: { color: '#9ca3af', glyph: '📍', labelKey: 'To deliver' },
    delivered: { color: '#22c55e', glyph: '📍', labelKey: 'Delivered' },
    failed: { color: '#ef4444', glyph: '📍', labelKey: 'Not delivered' },
    partial: { color: '#f97316', glyph: '📍', labelKey: 'Partial' },
    warehouse: { color: '#a855f7', glyph: '🏭', labelKey: 'Warehouse' },
    headquarters: { color: '#f59e0b', glyph: '🏢', labelKey: 'Head office' },
} as const;

type LayerKey = keyof typeof LAYERS;

/** Maps a delivery-note status onto the layer that represents it. */
const layerForStatus = (status: string): LayerKey => {
    if (status === 'delivered') return 'delivered';
    if (status === 'failed') return 'failed';
    if (status === 'partial' || status === 'returned') return 'partial';
    return 'pending';
};

// Centre of Algeria - the fallback view before anything is plotted.
const DEFAULT_CENTER: [number, number] = [28.0339, 1.6596];

const pin = (layer: LayerKey) => {
    const { color, glyph } = LAYERS[layer];

    return L.divIcon({
        html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);font-size:14px;line-height:1">${glyph}</span>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
};

function LegendSwatch({ layer, label }: { layer: LayerKey; label: string }) {
    const { color, glyph } = LAYERS[layer];

    return (
        <div className="flex items-center gap-1.5">
            <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: color }}
                aria-hidden="true"
            >
                {glyph}
            </span>
            <span>{label}</span>
        </div>
    );
}

function StatLine({ icon: Icon, tone, children }: { icon: any; tone: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4 shrink-0', tone)} />
            <span>{children}</span>
        </div>
    );
}

export default function DistributionMap() {
    const { t } = useTranslation();
    const {
        notes,
        drivers_on_map: driversOnMap,
        customers,
        warehouses,
        headquarters,
        rounds,
        drivers,
        unpinned,
    } = usePage<Props>().props;

    const [search, setSearch] = useState('');
    const [driverId, setDriverId] = useState('all');
    const [roundId, setRoundId] = useState('all');
    const [status, setStatus] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    // When set, the next click on the map pins this record.
    const [pinning, setPinning] = useState<Unpinned | 'headquarters' | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const fittedRef = useRef<string | null>(null);

    const refresh = () =>
        router.reload({
            only: ['notes', 'drivers_on_map', 'customers', 'warehouses', 'headquarters'],
            onStart: () => setIsRefreshing(true),
            onFinish: () => setIsRefreshing(false),
        });

    const visibleNotes = useMemo(() => {
        const term = search.trim().toLowerCase();

        return notes.filter((note) => {
            if (status !== 'all' && layerForStatus(note.status) !== status) return false;
            if (driverId !== 'all' && String(note.driver?.id ?? '') !== driverId) return false;
            if (roundId !== 'all' && String(note.round_id ?? '') !== roundId) return false;
            if (!term) return true;

            return (note.reference ?? '').toLowerCase().includes(term)
                || (note.driver?.name ?? '').toLowerCase().includes(term);
        });
    }, [driverId, notes, roundId, search, status]);

    const visibleDrivers = useMemo(
        () => (driverId === 'all' ? driversOnMap : driversOnMap.filter((v) => String(v.driver?.id ?? '') === driverId)),
        [driverId, driversOnMap]
    );

    // Identifies what is on the map, so the view is refitted when the set of
    // points changes but not when the same points are merely refreshed.
    const fitKey = useMemo(
        () =>
            [
                visibleNotes.map((n) => `n${n.id}`),
                visibleDrivers.map((d) => `v${d.id}`),
                customers.map((c) => `c${c.id}`),
                warehouses.map((w) => `w${w.id}`),
            ]
                .flat()
                .sort()
                .join(','),
        [customers, visibleDrivers, visibleNotes, warehouses]
    );

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        // Read the direction off the container rather than `document.dir`:
        // i18n sets the document direction asynchronously and may not have run
        // yet, while the layout wrapper's `dir` is already inherited here.
        const isRtl = getComputedStyle(containerRef.current).direction === 'rtl';

        const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: true })
            .setView(DEFAULT_CENTER, 5);

        // The stats card sits at the inline start, so the zoom control goes to
        // the opposite corner rather than underneath it.
        L.control.zoom({ position: isRtl ? 'topleft' : 'topright' }).addTo(map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        map.on('click', (event: L.LeafletMouseEvent) => {
            // Read the target from a ref-free closure would capture a stale
            // value, so the handler defers to the DOM dataset the UI keeps.
            const target = mapRef.current?.getContainer().dataset.pinTarget;
            if (!target) return;

            const [type, id] = target.split(':');

            router.post(
                route('distribution.map.pin'),
                {
                    type,
                    id: id ? Number(id) : null,
                    latitude: event.latlng.lat,
                    longitude: event.latlng.lng,
                },
                { preserveScroll: true, onFinish: () => setPinning(null) }
            );
        });

        setTimeout(() => map.invalidateSize(), 100);

        return () => {
            map.remove();
            mapRef.current = null;
            layerRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current || !layerRef.current) return;

        layerRef.current.clearLayers();
        const bounds = L.latLngBounds([]);

        const place = (
            latitude: number,
            longitude: number,
            layer: LayerKey,
            title: string,
            detail?: string
        ) => {
            const latLng = L.latLng(latitude, longitude);
            bounds.extend(latLng);

            L.marker(latLng, { icon: pin(layer) })
                .bindPopup(
                    `<div style="min-width:160px">
                        <div style="font-weight:700;margin-bottom:2px">${title}</div>
                        ${detail ? `<div>${detail}</div>` : ''}
                    </div>`
                )
                .addTo(layerRef.current!);
        };

        visibleNotes.forEach((note) =>
            place(
                note.latitude,
                note.longitude,
                layerForStatus(note.status),
                note.reference ?? `#${note.id}`,
                `${noteStatusLabel(note.status, t)} · ${formatCurrency(note.collected_amount)} / ${formatCurrency(note.total_amount)}`
            )
        );

        visibleDrivers.forEach((vehicle) =>
            place(
                vehicle.latitude,
                vehicle.longitude,
                'driver',
                vehicle.driver?.name ?? vehicle.name,
                vehicle.plate_number
            )
        );

        customers.forEach((customer) => place(customer.latitude, customer.longitude, 'customer', customer.name));
        warehouses.forEach((warehouse) => place(warehouse.latitude, warehouse.longitude, 'warehouse', warehouse.name));

        if (headquarters) {
            place(headquarters.latitude, headquarters.longitude, 'headquarters', t('Head office'));
        }

        // Refit only when the set of points changes - refitting on every
        // refresh would drag the view back from wherever the operator panned.
        if (bounds.isValid() && fittedRef.current !== fitKey) {
            mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            fittedRef.current = fitKey;
        }
    }, [customers, fitKey, headquarters, t, visibleDrivers, visibleNotes, warehouses]);

    useEffect(() => {
        const container = mapRef.current?.getContainer();
        if (!container) return;

        if (pinning) {
            container.dataset.pinTarget =
                pinning === 'headquarters' ? 'headquarters:' : `${pinning.type}:${pinning.id}`;
            container.style.cursor = 'crosshair';
        } else {
            delete container.dataset.pinTarget;
            container.style.cursor = '';
        }
    }, [pinning]);

    const legend: Array<[LayerKey, string]> = [
        ['driver', t('Driver')],
        ['customer', t('Customer')],
        ['pending', t('To deliver')],
        ['delivered', t('Delivered')],
        ['failed', t('Not delivered')],
        ['partial', t('Partial')],
        ['warehouse', t('Warehouse')],
        ['headquarters', t('Head office')],
    ];

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Distribution'), url: route('distribution.index') }, { label: t('Distribution Map') }]}
        >
            <Head title={t('Distribution Map')} />

            {/* The map is the page: it takes the height left under the header
                rather than sitting in a fixed-height box. */}
            <div className="flex h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
                <div className="space-y-3 border-b bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <MapIcon className="h-5 w-5 text-primary" />
                            <h1 className="text-xl font-bold">{t('Distribution Map')}</h1>
                        </div>
                        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
                            <RefreshCw className={cn('me-2 h-4 w-4', isRefreshing && 'animate-spin')} />
                            {t('Refresh')}
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="relative min-w-[200px] flex-1">
                            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="ps-9"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t('Search customer / delivery note...')}
                            />
                        </div>

                        <Select value={driverId} onValueChange={setDriverId}>
                            <SelectTrigger className="w-[180px]">
                                <Truck className="me-2 h-4 w-4 shrink-0" />
                                <SelectValue placeholder={t('All drivers')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All drivers')}</SelectItem>
                                {drivers.map((driver) => (
                                    <SelectItem key={driver.id} value={String(driver.id)}>
                                        {driver.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={roundId} onValueChange={setRoundId}>
                            <SelectTrigger className="w-[180px]">
                                <MapPin className="me-2 h-4 w-4 shrink-0" />
                                <SelectValue placeholder={t('All rounds')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All rounds')}</SelectItem>
                                {rounds.map((round) => (
                                    <SelectItem key={round.id} value={String(round.id)}>
                                        {round.reference}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="me-2 h-4 w-4 shrink-0" />
                                <SelectValue placeholder={t('All statuses')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All statuses')}</SelectItem>
                                <SelectItem value="pending">{t('To deliver')}</SelectItem>
                                <SelectItem value="delivered">{t('Delivered')}</SelectItem>
                                <SelectItem value="failed">{t('Not delivered')}</SelectItem>
                                <SelectItem value="partial">{t('Partial')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(unpinned.length > 0 || !headquarters) && (
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 text-xs">
                            <span className="text-muted-foreground">{t('Not placed yet')}:</span>
                            {!headquarters && (
                                <Button
                                    type="button"
                                    variant={pinning === 'headquarters' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPinning(pinning === 'headquarters' ? null : 'headquarters')}
                                >
                                    🏢 {t('Head office')}
                                </Button>
                            )}
                            {unpinned.map((item) => (
                                <Button
                                    key={`${item.type}-${item.id}`}
                                    type="button"
                                    variant={pinning !== 'headquarters' && pinning?.id === item.id && pinning?.type === item.type ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() =>
                                        setPinning(
                                            pinning !== 'headquarters' && pinning?.id === item.id && pinning?.type === item.type
                                                ? null
                                                : item
                                        )
                                    }
                                >
                                    {item.type === 'warehouse' ? '🏭' : '📍'} {item.name}
                                </Button>
                            ))}
                            {pinning && (
                                <span className="font-medium text-primary">{t('Click the map to place it')}</span>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs">
                        {legend.map(([layer, label]) => (
                            <LegendSwatch key={layer} layer={layer} label={label} />
                        ))}
                    </div>
                </div>

                {/*
                  * `isolate` is load-bearing: Leaflet puts its panes at z-index
                  * 400-700 and its controls at 1000, which outranked the
                  * body-level `z-50` portal the Select dropdowns render into,
                  * so an open dropdown was painted underneath the map. Making
                  * this a stacking context keeps those values local.
                  */}
                <div className="relative isolate min-h-0 flex-1">
                    <div ref={containerRef} className="absolute inset-0 h-full w-full" />

                    {/* Counts float over the map so they never push it smaller. */}
                    <div className="pointer-events-none absolute top-4 z-[1100] rounded-lg bg-background/90 p-3 shadow-lg backdrop-blur ltr:left-4 rtl:right-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <StatLine icon={Truck} tone="text-blue-500">
                                {visibleDrivers.length} {t('drivers')}
                            </StatLine>
                            <StatLine icon={User} tone="text-gray-500">
                                {customers.length} {t('customers')}
                            </StatLine>
                            <StatLine icon={Warehouse} tone="text-purple-500">
                                {warehouses.length} {t('warehouses')}
                            </StatLine>
                            <StatLine icon={Building2} tone="text-amber-500">
                                {headquarters ? t('Head office') : t('Head office not set')}
                            </StatLine>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
