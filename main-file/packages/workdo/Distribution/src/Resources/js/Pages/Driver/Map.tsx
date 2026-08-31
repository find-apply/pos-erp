import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Navigation, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/helpers';
import { DriverShell } from '../../Components/DriverShell';
import { noteStatusLabel } from '../../lib/status';

declare global {
    function route(name: string, params?: any): string;
}

type Stop = {
    id: number;
    reference: string;
    status: string;
    sequence: number;
    latitude: number;
    longitude: number;
    total_amount: number;
};

type Props = {
    driver: { id: number; name: string };
    stops: Stop[];
    me: { name: string; plate_number: string | null; latitude: number; longitude: number; last_ping_at: string | null } | null;
    warehouses: Array<{ id: number; name: string; latitude: number; longitude: number }>;
};

/** Same colours as the office map, so a stop reads the same on both. */
const STOP_COLORS: Record<string, string> = {
    delivered: '#22c55e',
    failed: '#ef4444',
    partial: '#f97316',
    returned: '#f97316',
};

const DEFAULT_CENTER: [number, number] = [28.0339, 1.6596];

const pin = (color: string, glyph: string, size = 28) =>
    L.divIcon({
        html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);font-size:${size / 2}px;line-height:1">${glyph}</span>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });

export default function DriverMap() {
    const { t } = useTranslation();
    const { driver, stops, me, warehouses } = usePage<Props>().props;

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const fittedRef = useRef<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const remaining = useMemo(
        () => stops.filter((stop) => ['pending', 'assigned', 'in_transit'].includes(stop.status)),
        [stops]
    );

    const fitKey = useMemo(
        () => [...stops.map((s) => `s${s.id}`), ...warehouses.map((w) => `w${w.id}`), me ? 'me' : ''].sort().join(','),
        [me, stops, warehouses]
    );

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const isRtl = getComputedStyle(containerRef.current).direction === 'rtl';

        const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: true })
            .setView(DEFAULT_CENTER, 5);

        L.control.zoom({ position: isRtl ? 'topleft' : 'topright' }).addTo(map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

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

        stops.forEach((stop) => {
            const latLng = L.latLng(stop.latitude, stop.longitude);
            bounds.extend(latLng);

            const open = ['pending', 'assigned', 'in_transit'].includes(stop.status);
            const color = STOP_COLORS[stop.status] ?? '#9ca3af';

            L.marker(latLng, {
                // Open stops carry their visiting number; finished ones do not
                // need one any more.
                icon: pin(color, open && stop.sequence > 0 ? String(stop.sequence) : '📍'),
            })
                .bindPopup(
                    `<div style="min-width:150px">
                        <div style="font-weight:700">${stop.reference}</div>
                        <div>${noteStatusLabel(stop.status, t)} · ${formatCurrency(stop.total_amount)}</div>
                        <a href="https://www.openstreetmap.org/?mlat=${stop.latitude}&mlon=${stop.longitude}#map=17/${stop.latitude}/${stop.longitude}" target="_blank" rel="noreferrer">${t('Navigate')}</a>
                    </div>`
                )
                .addTo(layerRef.current!);
        });

        warehouses.forEach((warehouse) => {
            const latLng = L.latLng(warehouse.latitude, warehouse.longitude);
            bounds.extend(latLng);
            L.marker(latLng, { icon: pin('#a855f7', '🏭') })
                .bindPopup(`<strong>${warehouse.name}</strong>`)
                .addTo(layerRef.current!);
        });

        if (me) {
            const latLng = L.latLng(me.latitude, me.longitude);
            bounds.extend(latLng);
            L.marker(latLng, { icon: pin('#3b82f6', '🚚', 32) })
                .bindPopup(`<strong>${t('You are here')}</strong><br>${me.plate_number ?? me.name}`)
                .addTo(layerRef.current!);
        }

        if (bounds.isValid() && fittedRef.current !== fitKey) {
            mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
            fittedRef.current = fitKey;
        }
    }, [fitKey, me, stops, t, warehouses]);

    const centreOnMe = () => {
        if (me && mapRef.current) {
            mapRef.current.setView([me.latitude, me.longitude], 15);
        }
    };

    const refresh = () =>
        router.reload({
            only: ['stops', 'me', 'warehouses'],
            onStart: () => setIsRefreshing(true),
            onFinish: () => setIsRefreshing(false),
        });

    return (
        <DriverShell
            driverName={driver.name}
            active="more"
            title={t('GPS Map')}
            subtitle={`${remaining.length} ${t('stops to go')}`}
            back={route('distribution.driver.more')}
            action={(
                <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                </Button>
            )}
        >
            <Head title={t('GPS Map')} />

            {/* `isolate` keeps Leaflet's z-index stack from outranking any
                portalled overlay, as it did on the office map. */}
            <div className="relative isolate h-[60vh] overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
                <div ref={containerRef} className="absolute inset-0 h-full w-full" />

                {me && (
                    <button
                        type="button"
                        onClick={centreOnMe}
                        className="absolute bottom-4 z-[1100] flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-lg ltr:right-4 rtl:left-4"
                        aria-label={t('Centre on me')}
                    >
                        <Crosshair className="h-5 w-5 text-primary" />
                    </button>
                )}

                {!me && (
                    <div className="pointer-events-none absolute inset-x-4 top-4 z-[1100] rounded-lg bg-background/90 p-3 text-center text-sm shadow-lg backdrop-blur">
                        <p className="font-medium">{t('Your position is not known yet')}</p>
                        <p className="text-muted-foreground">{t('Start tracking to appear on the map')}</p>
                    </div>
                )}
            </div>

            <ul className="mt-4 space-y-2">
                {remaining.map((stop) => (
                    <li
                        key={stop.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <span className="flex min-w-0 items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                {stop.sequence > 0 ? stop.sequence : '·'}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{stop.reference}</span>
                                <span className="block text-xs text-muted-foreground">
                                    {formatCurrency(stop.total_amount)}
                                </span>
                            </span>
                        </span>
                        <Button asChild variant="outline" size="sm">
                            <a
                                href={`https://www.openstreetmap.org/?mlat=${stop.latitude}&mlon=${stop.longitude}#map=17/${stop.latitude}/${stop.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Navigation className="h-4 w-4" />
                            </a>
                        </Button>
                    </li>
                ))}
            </ul>
        </DriverShell>
    );
}
