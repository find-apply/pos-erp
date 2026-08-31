import { Head, Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, CreditCard, LogOut, Package, Printer, Route as RouteIcon } from 'lucide-react';
import { DriverShell } from '../../Components/DriverShell';

declare global {
    function route(name: string, params?: any): string;
}

type Props = { driver: { id: number; name: string; code: string } };

function Row({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
    return (
        <Link href={href} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent">
            <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{label}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
        </Link>
    );
}

export default function DriverMore() {
    const { t } = useTranslation();
    const { driver } = usePage<Props>().props;

    return (
        <DriverShell driverName={driver.name} active="more" title={t('More')} subtitle={driver.code}>
            <Head title={t('More')} />

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <Row href={route('distribution.driver.round')} icon={RouteIcon} label={t('My round')} />
                    <Row href={route('distribution.driver.stock')} icon={Package} label={t('My stock')} />
                    <Row href={route('distribution.driver.debts')} icon={CreditCard} label={t('Customer receivables')} />
                    {/* The GPS Map row is hidden. The page still works and is
                        reachable at /livreur/map - restore the row with
                        route('distribution.driver.map') and the Map icon. */}
                    <Row href={route('distribution.driver.printer')} icon={Printer} label={t('Printer')} />
                </div>

                <div className="border-t border-gray-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => router.post(route('distribution.driver.logout'))}
                        className="flex w-full items-center gap-3 p-4 text-start text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {t('Sign out')}
                    </button>
                </div>
            </div>
        </DriverShell>
    );
}
