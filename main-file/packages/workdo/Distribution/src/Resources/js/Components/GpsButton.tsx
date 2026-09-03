import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import axios from 'axios';

declare global {
    function route(name: string, params?: any): string;
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

const DOT_TONES: Record<PermissionState, string> = {
    granted: 'bg-green-400',
    denied: 'bg-red-400',
    prompt: 'bg-amber-400',
    unsupported: 'bg-gray-400',
    unknown: 'bg-gray-400',
};

/**
 * Asks the device for location access, and shows whether it has it.
 *
 * Granting permission is not the same as being tracked. This button stores
 * the driver's latest position without moving them away from the current page.
 */
export function GpsButton() {
    const { t } = useTranslation();
    const [state, setState] = useState<PermissionState>('unknown');
    const [isAsking, setIsAsking] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setState('unsupported');
            return;
        }

        // The Permissions API is the only way to read the state without
        // prompting; Safari has historically lacked it, hence the fallback.
        if (!navigator.permissions?.query) {
            setState('unknown');
            return;
        }

        let status: PermissionStatus | null = null;
        const onChange = () => {
            if (mountedRef.current && status) setState(status.state as PermissionState);
        };

        navigator.permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((result) => {
                status = result;
                onChange();
                // Reflects the user revoking access in device settings.
                result.addEventListener('change', onChange);
            })
            .catch(() => setState('unknown'));

        return () => {
            status?.removeEventListener('change', onChange);
        };
    }, []);

    const savePosition = useCallback((position: GeolocationPosition) => {
        return axios.post(route('distribution.driver.location'), {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
        });
    }, []);

    const requestAndSavePosition = useCallback(() => {
        setIsAsking(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (!mountedRef.current) return;
                savePosition(position)
                    .catch(() => {
                        toast.error(t('Location was allowed, but the position was not saved.'));
                    })
                    .finally(() => {
                        if (!mountedRef.current) return;
                        setIsAsking(false);
                        setState('granted');
                        toast.success(t('Location access granted.'));
                    });
            },
            (error) => {
                if (!mountedRef.current) return;
                setIsAsking(false);

                if (error.code === error.PERMISSION_DENIED) {
                    setState('denied');
                    toast.error(t('Location access refused.'));
                    return;
                }

                toast.error(t('Could not read your location. Try again outdoors.'));
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [savePosition, t]);

    const handleClick = () => {
        if (state === 'unsupported') {
            toast.error(t('This device cannot share its location.'));
            return;
        }

        if (state === 'denied') {
            toast.error(t('Location is blocked. Allow it for this site in your browser settings.'));
            return;
        }

        if (state === 'granted') {
            requestAndSavePosition();
            return;
        }

        // Asking for a position is what raises the browser prompt; there is no
        // way to request the permission on its own.
        requestAndSavePosition();
    };

    const label =
        state === 'granted'
            ? t('GPS tracking')
            : state === 'denied'
              ? t('Location is blocked')
              : t('Allow location access');

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isAsking}
            aria-label={label}
            title={label}
            className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors disabled:opacity-70',
                state === 'granted' ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'
            )}
        >
            <MapPin className={cn('h-4 w-4', isAsking && 'animate-pulse')} />
            <span
                className={cn(
                    'absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                    DOT_TONES[state]
                )}
                aria-hidden="true"
            />
        </button>
    );
}
