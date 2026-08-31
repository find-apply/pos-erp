import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Check, FileText, Printer as PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DeliveryReceipt } from '../../Components/DeliveryReceipt';
import { DriverShell } from '../../Components/DriverShell';

declare global {
    function route(name: string, params?: any): string;
}

type Props = { driver: { id: number; name: string } };

/** Widths are in characters per line, which is what a thermal receipt needs. */
const FORMATS = [
    { value: '52mm', labelKey: 'Compact thermal receipt', columns: 32 },
    { value: '58mm', labelKey: 'Standard thermal receipt', columns: 32 },
    { value: '80mm', labelKey: 'Wide thermal receipt', columns: 48 },
    { value: 'a5', labelKey: '148 × 210 mm', columns: 48 },
    { value: 'a4', labelKey: '210 × 297 mm', columns: 64 },
] as const;

const STORAGE_KEY = 'distribution.printer.format';

export default function DriverPrinter() {
    const { t } = useTranslation();
    const page = usePage<Props & { appName?: string }>();
    const { driver } = page.props;
    const company = (page.props as any).appName ?? 'DzERP';

    // The chosen size belongs to the device, not the account - one driver may
    // use a different printer on a different phone.
    const [format, setFormat] = useState('58mm');

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && FORMATS.some((f) => f.value === stored)) {
                setFormat(stored);
            }
        } catch {
            // Private browsing can throw on access; the default stands.
        }
    }, []);

    const choose = (value: string) => {
        setFormat(value);
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch {
            // Not being able to remember the choice is not worth an error.
        }
    };

    const selected = FORMATS.find((f) => f.value === format);

    // A sample receipt, so the test shows what a real one looks like on this
    // paper rather than printing the settings screen.
    const [testing, setTesting] = useState(false);

    const testPrint = () => {
        setTesting(true);
        requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    };

    return (
        <DriverShell
            driverName={driver.name}
            active="more"
            title={t('Printer setup')}
            subtitle={t('Printing options for your receipts')}
            back={route('distribution.driver.more')}
        >
            <Head title={t('Printer setup')} />

            <div className="space-y-4">
                <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                        <FileText className="h-5 w-5" />
                        {t('Paper size')}
                    </h2>
                    <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
                        {t('Pick the size that matches your printer')}
                    </p>

                    <div role="radiogroup" aria-label={t('Paper size')} className="grid gap-3">
                        {FORMATS.map((option) => {
                            const isSelected = option.value === format;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    onClick={() => choose(option.value)}
                                    className={cn(
                                        'flex items-center justify-between gap-3 rounded-lg border p-4 text-start transition-all hover:bg-accent',
                                        isSelected && 'border-primary bg-primary/5'
                                    )}
                                >
                                    <span className="flex items-center gap-3">
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                                            <PrinterIcon className="h-5 w-5 text-muted-foreground" />
                                        </span>
                                        <span>
                                            <span className="block font-medium uppercase">{option.value}</span>
                                            <span className="block text-sm text-muted-foreground">{t(option.labelKey)}</span>
                                        </span>
                                    </span>
                                    {isSelected && <Check className="h-5 w-5 shrink-0 text-primary" />}
                                </button>
                            );
                        })}
                    </div>

                    <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                        <strong>{t('Tip')}:</strong>{' '}
                        {t('52mm, 58mm and 80mm are thermal receipt printers. A5 and A4 are ordinary printers.')}
                    </p>
                </section>

                <section className="rounded-xl border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-950/20">
                    <h2 className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
                        <Check className="h-5 w-5" />
                        {t('System printing')}
                    </h2>
                    <p className="mb-3 mt-0.5 text-sm text-green-600 dark:text-green-500">
                        {t('Works with every printer set up on your device: Bluetooth, WiFi, AirPrint, USB')}
                    </p>

                    <ol className="mb-3 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                        <li>{t('Set your printer up in your device settings')}</li>
                        <li>{t('Choose the paper size above')}</li>
                        <li>{t('Press Print in the app')}</li>
                        <li>{t('Your device shows its own print dialog')}</li>
                    </ol>

                    <Button variant="outline" className="w-full" onClick={testPrint}>
                        <PrinterIcon className="me-2 h-4 w-4" />
                        {t('Test printing')} ({format.toUpperCase()})
                    </Button>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">{t('Technical information')}</h2>
                    <p>
                        {format.toUpperCase()} ({selected?.columns} {t('characters per line')})
                    </p>
                    <p className="truncate">{typeof navigator !== 'undefined' ? navigator.userAgent : ''}</p>
                </section>
            </div>
            {testing && (
                <DeliveryReceipt
                    note={{
                        id: 0,
                        reference: 'BL-XXXX-0000',
                        status: 'delivered',
                        total_amount: 12500,
                        collected_amount: 12500,
                        recipient_name: t('Sample'),
                        customer_name: t('Sample customer'),
                        items: [
                            { description: t('Sample item'), quantity: 2, unit_price: 3500 },
                            { description: t('Sample item'), quantity: 1, unit_price: 5500 },
                        ],
                    }}
                    company={company}
                    driverName={driver.name}
                    format={format}
                />
            )}
        </DriverShell>
    );
}
