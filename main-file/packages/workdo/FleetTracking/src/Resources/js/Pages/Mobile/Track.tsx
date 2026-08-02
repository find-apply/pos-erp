import { useEffect, useRef, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Battery, CheckCircle2, Clock3, LocateFixed, MapPin, Octagon, Play, Radio, Square, Truck } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/utils/helpers';

declare global {
    function route(name: string, params?: any): string;
}

type Assignment = {
    id: number;
    vehicle_id: number;
    status: string;
    vehicle?: {
        id: number;
        name: string;
        plate_number: string;
    } | null;
};

type Session = {
    id: number;
    status: string;
    started_at?: string | null;
    last_ping_at?: string | null;
};

type Props = {
    driver: {
        id: number;
        name: string;
        email: string;
    };
    assignment: Assignment | null;
    session: Session | null;
    tracking_policy: {
        interval_seconds: number;
        movement_meters: number;
        stationary_heartbeat_seconds: number;
        stale_after_minutes: number;
        scope: string;
    };
};

type LastPosition = {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
    battery?: number | null;
    recorded_at: string;
};

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const distanceMeters = (a: LastPosition, b: LastPosition) => {
    const earthRadius = 6371000;
    const toRad = (value: number) => value * Math.PI / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

export default function Track() {
    const { t } = useTranslation();
    const { driver, assignment, session: initialSession, tracking_policy } = usePage<Props>().props;
    const [session, setSession] = useState<Session | null>(initialSession);
    const [lastPosition, setLastPosition] = useState<LastPosition | null>(null);
    const [lastSentAt, setLastSentAt] = useState<string | null>(initialSession?.last_ping_at || null);
    const [message, setMessage] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [isWatching, setIsWatching] = useState(false);
    const watchIdRef = useRef<number | null>(null);
    const heartbeatRef = useRef<number | null>(null);
    const lastSentPositionRef = useRef<LastPosition | null>(null);
    const lastSentTimeRef = useRef<number>(0);

    const postJson = async (url: string, payload: Record<string, any> = {}) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
            },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = data?.message || Object.values(data?.errors || {})?.flat()?.[0] || t('Request failed.');
            throw new Error(String(error));
        }

        return data;
    };

    const readBattery = async () => {
        const nav = navigator as any;
        if (!nav.getBattery) return null;

        try {
            const battery = await nav.getBattery();
            return Math.round((battery.level || 0) * 100);
        } catch {
            return null;
        }
    };

    const sendPosition = async (position: LastPosition, force = false) => {
        const nowMs = Date.now();
        const secondsSinceLast = lastSentTimeRef.current ? (nowMs - lastSentTimeRef.current) / 1000 : Number.POSITIVE_INFINITY;
        const movedMeters = lastSentPositionRef.current ? distanceMeters(lastSentPositionRef.current, position) : Number.POSITIVE_INFINITY;

        if (!force && secondsSinceLast < tracking_policy.interval_seconds && movedMeters < tracking_policy.movement_meters) {
            return;
        }

        await postJson(route('fleet-tracking.pings.store'), position);
        lastSentPositionRef.current = position;
        lastSentTimeRef.current = nowMs;
        setLastSentAt(position.recorded_at);
        setMessage(t('Location sent successfully.'));
    };

    const handlePosition = async (geoPosition: GeolocationPosition, force = false) => {
        const battery = await readBattery();
        const coords = geoPosition.coords;
        const position: LastPosition = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            speed: coords.speed,
            heading: coords.heading,
            battery,
            recorded_at: new Date().toISOString(),
        };

        setLastPosition(position);
        await sendPosition(position, force);
    };

    const startWatching = () => {
        if (!navigator.geolocation) {
            setMessage(t('Geolocation is not supported on this device.'));
            return;
        }

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                handlePosition(position).catch((error) => setMessage(error.message));
            },
            (error) => setMessage(error.message),
            {
                enableHighAccuracy: true,
                maximumAge: 30000,
                timeout: 30000,
            }
        );

        heartbeatRef.current = window.setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    handlePosition(position, true).catch((error) => setMessage(error.message));
                },
                (error) => setMessage(error.message),
                {
                    enableHighAccuracy: true,
                    maximumAge: 30000,
                    timeout: 30000,
                }
            );
        }, tracking_policy.stationary_heartbeat_seconds * 1000);

        setIsWatching(true);
    };

    const clearWatchers = () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (heartbeatRef.current !== null) {
            window.clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        setIsWatching(false);
    };

    const startTracking = async () => {
        if (!assignment?.vehicle_id) return;
        setIsBusy(true);
        setMessage('');

        try {
            const data = await postJson(route('fleet-tracking.sessions.start'), {
                vehicle_id: assignment.vehicle_id,
            });
            setSession(data.session);
            startWatching();
            navigator.geolocation.getCurrentPosition(
                (position) => handlePosition(position, true).catch((error) => setMessage(error.message)),
                (error) => setMessage(error.message),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
            );
        } catch (error: any) {
            setMessage(error.message);
        } finally {
            setIsBusy(false);
        }
    };

    const stopTracking = async () => {
        setIsBusy(true);
        setMessage('');

        try {
            await postJson(route('fleet-tracking.sessions.stop'));
            clearWatchers();
            setSession(null);
            setMessage(t('Tracking stopped.'));
        } catch (error: any) {
            setMessage(error.message);
        } finally {
            setIsBusy(false);
        }
    };

    useEffect(() => {
        if (initialSession?.status === 'active') {
            startWatching();
        }

        return () => clearWatchers();
    }, []);

    const isActive = Boolean(session?.status === 'active');

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Fleet Tracking'), url: route('fleet-tracking.index') },
                { label: t('Driver Tracking') },
            ]}
            pageTitle={t('Driver Tracking')}
        >
            <Head title={t('Driver Tracking')} />

            <div className="mx-auto max-w-3xl space-y-5">
                <Card className="border-border/70 shadow-sm">
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl">{driver.name}</CardTitle>
                                <CardDescription>{t('Work-hours mobile GPS tracking')}</CardDescription>
                            </div>
                            <Badge variant={isActive ? 'default' : 'secondary'} className="shrink-0">
                                {isActive ? t('Tracking active') : t('Tracking stopped')}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border p-4">
                                <div className="flex items-center gap-3">
                                    <Truck className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('Assigned Vehicle')}</p>
                                        <p className="font-semibold">{assignment?.vehicle ? `${assignment.vehicle.name} (${assignment.vehicle.plate_number})` : t('No active assignment')}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border p-4">
                                <div className="flex items-center gap-3">
                                    <Radio className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">{t('GPS Watch')}</p>
                                        <p className="font-semibold">{isWatching ? t('Running') : t('Stopped')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                <p className="text-sm leading-6">
                                    {t('By pressing Start, you accept sending your work location while this session is active. Stop ends the session and the browser watcher is cleared.')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button className="h-12 flex-1" onClick={startTracking} disabled={isBusy || isActive || !assignment}>
                                <Play className="mr-2 h-5 w-5" />
                                {t('Start Work Tracking')}
                            </Button>
                            <Button className="h-12 flex-1" variant="outline" onClick={stopTracking} disabled={isBusy || !isActive}>
                                <Square className="mr-2 h-5 w-5" />
                                {t('Stop Tracking')}
                            </Button>
                        </div>

                        {message && (
                            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{message}</div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Last Coordinates')}</p>
                                <p className="font-semibold">{lastPosition ? `${lastPosition.latitude.toFixed(6)}, ${lastPosition.longitude.toFixed(6)}` : '-'}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                                <Clock3 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Last Sent')}</p>
                                <p className="font-semibold">{lastSentAt ? formatDateTime(lastSentAt) : '-'}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <LocateFixed className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Accuracy')}</p>
                                <p className="font-semibold">{lastPosition?.accuracy ? `${Math.round(lastPosition.accuracy)} m` : '-'}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border/70 shadow-sm">
                        <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                <Battery className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('Battery')}</p>
                                <p className="font-semibold">{lastPosition?.battery !== null && lastPosition?.battery !== undefined ? `${lastPosition.battery}%` : '-'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {!assignment && (
                    <Card className="border-amber-200 bg-amber-50 text-amber-950 shadow-sm">
                        <CardContent className="flex items-start gap-3 p-4">
                            <Octagon className="mt-0.5 h-5 w-5 shrink-0" />
                            <p className="text-sm leading-6">{t('You need an active vehicle assignment before starting tracking.')}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
