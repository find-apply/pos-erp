import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, Navigation, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/helpers';

declare global {
    function route(name: string, params?: any): string;
}

type Stop = {
    id: number;
    order: number;
    reference: string | null;
    status: string;
    customer: string | null;
    total_amount: number;
    collected_amount: number;
    latitude: number | null;
    longitude: number | null;
};

type Vehicle = {
    id: number;
    name: string;
    plate_number: string;
    latitude: number | null;
    longitude: number | null;
    speed: number | null;
    last_ping_at: string | null;
    source: string | null;
    tracking_status: 'online' | 'stale' | 'offline' | string;
};

type Tracking = {
    round: { id: number; reference: string | null; status: string; driver: { id: number; name: string } | null };
    stops: Stop[];
    vehicle: Vehicle | null;
};

/** The vehicle marker moves on its own, so the map is refreshed while open. */
const POLL_MS = 20000;

const DONE = ['delivered', 'partial'];

const stopColor = (status: string) => {
    if (DONE.includes(status)) return '#16a34a';
    if (status === 'failed') return '#dc2626';
    if (status === 'in_transit') return '#2563eb';
    return '#64748b';
};

const vehicleColor = (status: string) =>
    status === 'online' ? '#16a34a' : status === 'stale' ? '#f59e0b' : '#64748b';

const stopIcon = (stop: Stop) =>
    L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<div style="width:28px;height:28px;border-radius:999px;border:3px solid #fff;background:${stopColor(stop.status)};box-shadow:0 6px 16px rgba(15,23,42,.28);display:flex;align-items:center;justify-content:center;color:#fff;font:600 12px/1 system-ui,sans-serif">${stop.order}</div>`,
    });

const vehicleIcon = (vehicle: Vehicle) =>
    L.divIcon({
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<div style="width:34px;height:34px;border-radius:999px;border:3px solid #fff;background:${vehicleColor(vehicle.tracking_status)};box-shadow:0 8px 20px rgba(15,23,42,.32);display:flex;align-items:center;justify-content:center">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
        </div>`,
    });

export function RoundMapDialog({ roundId, onClose }: { roundId: number; onClose: () => void }) {
    const { t } = useTranslation();
    const [data, setData] = useState<Tracking | null>(null);
    const [failed, setFailed] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    // Only the first draw fits the view; refitting on every poll would fight
    // whoever is panning the map.
    const fitted = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const load = () => {
            axios.get(route('distribution.rounds.track', roundId))
                .then((response) => {
                    if (!cancelled) {
                        setData(response.data);
                        setFailed(false);
                    }
                })
                .catch(() => {
                    // Keep the last good picture; a dropped poll is not an error
                    // worth blanking the map for.
                    if (!cancelled && !data) setFailed(true);
                });
        };

        load();
        const timer = setInterval(load, POLL_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roundId]);

    const located = useMemo(
        () => (data?.stops ?? []).filter((stop) => stop.latitude !== null && stop.longitude !== null),
        [data]
    );
    const missing = (data?.stops.length ?? 0) - located.length;

    useEffect(() => {
        if (!containerRef.current || !data) return;

        if (!mapRef.current) {
            mapRef.current = L.map(containerRef.current, { zoomControl: true });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap',
                maxZoom: 19,
            }).addTo(mapRef.current);
            layerRef.current = L.layerGroup().addTo(mapRef.current);
        }

        const map = mapRef.current;
        const layer = layerRef.current!;
        layer.clearLayers();

        const points: L.LatLngExpression[] = [];

        // The planned route, drawn in delivery order.
        const path = located.map((stop) => [stop.latitude!, stop.longitude!] as L.LatLngExpression);
        if (path.length > 1) {
            L.polyline(path, { color: '#0f766e', weight: 3, opacity: 0.5, dashArray: '6 8' }).addTo(layer);
        }

        located.forEach((stop) => {
            const at: L.LatLngExpression = [stop.latitude!, stop.longitude!];
            points.push(at);
            L.marker(at, { icon: stopIcon(stop) })
                .bindPopup(
                    `<strong>${stop.order}. ${stop.customer ?? t('Customer')}</strong><br>${stop.reference ?? ''}<br>${t(
                        'Collected'
                    )}: ${stop.collected_amount} / ${stop.total_amount}`
                )
                .addTo(layer);
        });

        const vehicle = data.vehicle;
        if (vehicle && vehicle.latitude !== null && vehicle.longitude !== null) {
            const at: L.LatLngExpression = [vehicle.latitude, vehicle.longitude];
            points.push(at);
            L.marker(at, { icon: vehicleIcon(vehicle), zIndexOffset: 1000 })
                .bindPopup(`<strong>${vehicle.name}</strong><br>${vehicle.plate_number}`)
                .addTo(layer);
        }

        if (points.length && !fitted.current) {
            map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
            fitted.current = true;
        } else if (!points.length && !fitted.current) {
            // Nothing to show yet; a neutral view beats an empty grey square.
            map.setView([28.0339, 1.6596], 5);
            fitted.current = true;
        }

        // Leaflet measures the container on creation, and inside a dialog that
        // happens before the open animation has settled.
        setTimeout(() => map.invalidateSize(), 80);
    }, [data, located, t]);

    useEffect(() => () => {
        mapRef.current?.remove();
        mapRef.current = null;
    }, []);

    const vehicle = data?.vehicle ?? null;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        {t('Track the round')}
                        {data?.round.reference && <span className="text-muted-foreground">{data.round.reference}</span>}
                    </DialogTitle>
                    <DialogDescription>
                        {data?.round.driver?.name ?? t('No driver')}
                        {vehicle && (
                            <>
                                {' — '}
                                {vehicle.name} <span dir="ltr">({vehicle.plate_number})</span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        {vehicle ? (
                            <Badge
                                variant={vehicle.tracking_status === 'online' ? 'default' : 'secondary'}
                                className="gap-1"
                            >
                                <Navigation className="h-3 w-3" />
                                {vehicle.tracking_status === 'online'
                                    ? t('Live')
                                    : vehicle.tracking_status === 'stale'
                                        ? t('Last known position')
                                        : t('Offline')}
                            </Badge>
                        ) : (
                            // A driver with no vehicle is the common reason the
                            // car never appears, so name it instead of showing
                            // an empty map.
                            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                <TriangleAlert className="h-4 w-4" />
                                {t('This driver has no vehicle assigned.')}
                            </span>
                        )}

                        {vehicle?.speed !== null && vehicle?.speed !== undefined && (
                            <span className="text-muted-foreground">{Math.round(vehicle.speed)} km/h</span>
                        )}

                        <span className="ms-auto flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            {located.length} / {data?.stops.length ?? 0} {t('stops on the map')}
                        </span>
                    </div>

                    {missing > 0 && (
                        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            {t('Stops without a customer pin are not drawn:')} {missing}
                        </p>
                    )}

                    <div className="relative h-[460px] overflow-hidden rounded-xl border">
                        <div ref={containerRef} className="h-full w-full" />
                        {!data && !failed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {failed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
                                {t('Could not load the map.')}
                            </div>
                        )}
                    </div>

                    {/* The order the driver is meant to follow, readable without
                        opening every marker. */}
                    {data && data.stops.length > 0 && (
                        <ol className="max-h-40 space-y-1 overflow-y-auto text-sm">
                            {data.stops.map((stop) => (
                                <li key={stop.id} className="flex items-center gap-2 rounded-lg border p-2">
                                    <span
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                                        style={{ background: stopColor(stop.status) }}
                                    >
                                        {stop.order}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{stop.customer ?? stop.reference}</span>
                                    {stop.latitude === null && (
                                        <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                                            {t('No pin')}
                                        </span>
                                    )}
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {formatCurrency(stop.total_amount)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
