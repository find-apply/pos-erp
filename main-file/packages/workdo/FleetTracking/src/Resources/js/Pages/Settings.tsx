import { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Cable, Check, Copy, KeyRound, Radio, Truck } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/page-kit';

declare global {
    function route(name: string, params?: any): string;
}

type Props = {
    device_endpoint: string;
    traccar: { endpoint: string; secret: string } | null;
    can: {
        manage_vehicles: boolean;
        manage_fleet: boolean;
    };
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
 * Where position data comes in from: the raw device endpoint and Traccar
 * forwarding. Split out of the vehicle registry because this is configured
 * once and then left alone, while vehicles change constantly.
 */
export default function FleetIntakeSettings() {
    const { t } = useTranslation();
    const { device_endpoint, traccar, can } = usePage<Props>().props;

    const [copied, setCopied] = useState(false);
    // Keyed rather than boolean: the Traccar card has two independently
    // copyable values, and one shared flag would tick both buttons at once.
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyValue = async (key: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
        } catch {
            // Clipboard needs a secure context; the value stays selectable.
        }
    };

    const copyEndpoint = async () => {
        try {
            await navigator.clipboard.writeText(device_endpoint);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard can be unavailable (e.g. insecure context) - the URL stays selectable.
        }
    };

    return (
        <AuthenticatedLayout
            breadcrumbs={[
                { label: t('Vehicles'), url: route('fleet-tracking.vehicles.index') },
                { label: t('Intake Settings') },
            ]}
            pageTitle={t('Intake Settings')}
            pageActions={(
                <Button asChild variant="outline" size="sm">
                    <Link href={route('fleet-tracking.vehicles.index')}>
                        <Truck className="me-2 h-4 w-4" />
                        {t('Back to Vehicles')}
                    </Link>
                </Button>
            )}
        >
            <Head title={t('Intake Settings')} />

            <div className="mx-auto max-w-7xl space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                    <SectionCard
                        title={t('Device Intake Endpoint')}
                        description={t('GPS hardware posts JSON to this URL, authenticated by the vehicle device token.')}
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <code
                                dir="ltr"
                                className="flex-1 break-all rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-slate-950 dark:text-gray-300"
                            >
                                {device_endpoint}
                            </code>
                            <Button type="button" variant="outline" size="sm" onClick={copyEndpoint} className="shrink-0">
                                {copied ? (
                                    <Check className="me-2 h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Copy className="me-2 h-4 w-4" />
                                )}
                                {copied ? t('Copied') : t('Copy')}
                            </Button>
                        </div>

                        <Collapsible className="mt-3">
                            <CollapsibleTrigger className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                                {t('Show example request')}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <pre
                                    dir="ltr"
                                    className="mt-2 overflow-x-auto rounded-lg border bg-gray-50 p-3 text-xs text-gray-700 dark:bg-slate-950 dark:text-gray-300"
                                >
                                    {DEVICE_PING_EXAMPLE}
                                </pre>
                                <div className="mt-3 grid gap-3">
                                    <div className="flex items-start gap-3 rounded-lg border p-3">
                                        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                                        <div>
                                            <p className="text-sm font-medium">
                                                {t('Device token is the private key for GPS hardware.')}
                                            </p>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                {t('Keep it unique per vehicle. Hardware posts location to the device endpoint with this token.')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 rounded-lg border p-3">
                                        <Radio className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                                        <div>
                                            <p className="text-sm font-medium">{t('Mobile GPS stays the main v1 source.')}</p>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                {t('Drivers still start and stop work tracking from the mobile page.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </SectionCard>

                    {traccar && (
                        <SectionCard
                            title={t('Traccar Integration')}
                            description={t('Let a Traccar server forward its positions here, so any tracker Traccar supports appears on your map.')}
                        >
                            <div className="grid gap-3">
                                <div>
                                    <Label>{t('Forward URL')}</Label>
                                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <code
                                            dir="ltr"
                                            className="flex-1 break-all rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-slate-950 dark:text-gray-300"
                                        >
                                            {traccar.endpoint}
                                        </code>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0"
                                            onClick={() => copyValue('url', traccar.endpoint)}
                                        >
                                            {copiedKey === 'url' ? (
                                                <Check className="me-2 h-4 w-4 text-green-600 dark:text-green-400" />
                                            ) : (
                                                <Copy className="me-2 h-4 w-4" />
                                            )}
                                            {copiedKey === 'url' ? t('Copied') : t('Copy')}
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <Label>{t('Secret header')}</Label>
                                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                                        <code
                                            dir="ltr"
                                            className="flex-1 break-all rounded-lg border bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-slate-950 dark:text-gray-300"
                                        >
                                            X-Traccar-Secret: {traccar.secret}
                                        </code>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="shrink-0"
                                            onClick={() => copyValue('secret', `X-Traccar-Secret: ${traccar.secret}`)}
                                        >
                                            {copiedKey === 'secret' ? (
                                                <Check className="me-2 h-4 w-4 text-green-600 dark:text-green-400" />
                                            ) : (
                                                <Copy className="me-2 h-4 w-4" />
                                            )}
                                            {copiedKey === 'secret' ? t('Copied') : t('Copy')}
                                        </Button>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {t('Anyone holding this secret can post positions for your vehicles. Treat it as a password.')}
                                    </p>
                                </div>
                            </div>

                            <Collapsible className="mt-3">
                                <CollapsibleTrigger className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                                    {t('Show Traccar configuration')}
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <pre
                                        dir="ltr"
                                        className="mt-2 overflow-x-auto rounded-lg border bg-gray-50 p-3 text-xs text-gray-700 dark:bg-slate-950 dark:text-gray-300"
                                    >
{`<!-- traccar.xml -->
<entry key='forward.enable'>true</entry>
<entry key='forward.type'>json</entry>
<entry key='forward.url'>${traccar.endpoint}</entry>
<entry key='forward.header'>X-Traccar-Secret: ${traccar.secret}</entry>`}
                                    </pre>
                                    <div className="mt-3 grid gap-3">
                                        <div className="flex items-start gap-3 rounded-lg border p-3">
                                            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {t('Each vehicle needs its Traccar Device ID filled in.')}
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                    {t('It must match the identifier Traccar shows for the device, usually the IMEI. Positions for unknown devices are rejected.')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 rounded-lg border p-3">
                                            <Radio className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {t('Traccar positions do not need an open work session.')}
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                    {t('A tracker fitted to the vehicle reports at all times. When a driver has tracking running, the position is also attributed to them.')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </SectionCard>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
