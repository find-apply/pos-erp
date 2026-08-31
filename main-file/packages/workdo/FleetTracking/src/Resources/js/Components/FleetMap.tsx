import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';

declare global {
    function route(name: string, params?: any): string;
}

type Driver = {
    id: number;
    name: string;
    email?: string;
};

export type FleetMapVehicle = {
    id: number;
    name: string;
    plate_number: string;
    vehicle_type?: string;
    status?: string;
    tracking_status: 'online' | 'stale' | 'offline' | string;
    gps_device_name?: string | null;
    has_device_token?: boolean;
    traccar_unique_id?: string | null;
    airtag_reference?: string | null;
    notes?: string | null;
    last_latitude?: number | null;
    last_longitude?: number | null;
    last_ping_at?: string | null;
    driver?: Driver | null;
};

type Props = {
    vehicles: FleetMapVehicle[];
    className?: string;
    focusedVehicleId?: number;
    interactiveLinks?: boolean;
};

const statusColor = (status: string) => {
    if (status === 'online') return '#16a34a';
    if (status === 'stale') return '#f59e0b';
    return '#64748b';
};

const markerHtml = (vehicle: FleetMapVehicle) => {
    const color = statusColor(vehicle.tracking_status);
    return `
        <div style="
            width: 30px;
            height: 30px;
            border-radius: 999px;
            border: 3px solid #ffffff;
            background: ${color};
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.24);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: 700;
        ">
            ${vehicle.plate_number.slice(0, 2).toUpperCase()}
        </div>
    `;
};

export default function FleetMap({ vehicles, className = 'h-[440px]', focusedVehicleId, interactiveLinks = true }: Props) {
    const { t } = useTranslation();
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.LayerGroup | null>(null);

    const locatedVehicles = useMemo(
        () => vehicles.filter((vehicle) => vehicle.last_latitude !== null && vehicle.last_latitude !== undefined && vehicle.last_longitude !== null && vehicle.last_longitude !== undefined),
        [vehicles]
    );

    // Identifies the *set* of mapped vehicles, ignoring their coordinates, so a
    // position refresh can be told apart from vehicles entering or leaving the map.
    const locatedIdsKey = useMemo(
        () => locatedVehicles.map((vehicle) => vehicle.id).sort((a, b) => a - b).join(','),
        [locatedVehicles]
    );
    const fittedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
        }).setView([28.0339, 1.6596], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        markersRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        setTimeout(() => map.invalidateSize(), 100);

        return () => {
            map.remove();
            mapRef.current = null;
            markersRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current || !markersRef.current) return;

        markersRef.current.clearLayers();

        const bounds = L.latLngBounds([]);

        locatedVehicles.forEach((vehicle) => {
            const latLng = L.latLng(Number(vehicle.last_latitude), Number(vehicle.last_longitude));
            bounds.extend(latLng);

            const marker = L.marker(latLng, {
                icon: L.divIcon({
                    html: markerHtml(vehicle),
                    className: '',
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                }),
            });

            const driver = vehicle.driver?.name ? `<div><strong>Driver:</strong> ${vehicle.driver.name}</div>` : '';
            const popup = `
                <div style="min-width: 190px">
                    <div style="font-weight: 700; margin-bottom: 4px">${vehicle.name}</div>
                    <div>${vehicle.plate_number}</div>
                    ${driver}
                    <div><strong>Status:</strong> ${vehicle.tracking_status}</div>
                    ${vehicle.last_ping_at ? `<div><strong>Last ping:</strong> ${new Date(vehicle.last_ping_at).toLocaleString()}</div>` : ''}
                </div>
            `;

            marker.bindPopup(popup);

            if (interactiveLinks) {
                marker.on('click', () => {
                    marker.openPopup();
                });
                marker.on('dblclick', () => {
                    window.location.href = route('fleet-tracking.vehicles.show', vehicle.id);
                });
            }

            marker.addTo(markersRef.current!);
        });

        if (focusedVehicleId) {
            const focused = locatedVehicles.find((vehicle) => vehicle.id === focusedVehicleId);
            if (focused) {
                mapRef.current.setView([Number(focused.last_latitude), Number(focused.last_longitude)], 14);
                return;
            }
        }

        // Refit only when the set of vehicles changes. The map polls for fresh
        // positions, and refitting on every tick would drag the view back from
        // wherever the operator had panned or zoomed.
        if (bounds.isValid() && fittedKeyRef.current !== locatedIdsKey) {
            mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
            fittedKeyRef.current = locatedIdsKey;
        }
    }, [focusedVehicleId, interactiveLinks, locatedVehicles, locatedIdsKey]);

    return (
        <div className={`relative overflow-hidden rounded-lg border bg-muted ${className}`}>
            <div ref={mapContainerRef} className="h-full w-full" />
            {locatedVehicles.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70">
                    <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                        {t('No vehicle location has been received yet.')}
                    </div>
                </div>
            )}
        </div>
    );
}
