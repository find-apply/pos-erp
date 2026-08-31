import { PropsWithChildren, ReactNode } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Home, LogOut, MoreHorizontal, Package, Printer, RefreshCw, Route as RouteIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GpsButton } from './GpsButton';

declare global {
    function route(name: string, params?: any): string;
}

type Tab = { key: string; href: string; label: string; icon: any };

/**
 * Chrome for the driver's phone: a fixed brand bar, and a bottom tab bar
 * that stays put while the page between them scrolls.
 *
 * Tabs are matched on the current path so the active one survives a full page
 * load, not just client-side navigation.
 */
export function DriverShell({
    driverName,
    active,
    title,
    subtitle,
    back,
    action,
    children,
}: PropsWithChildren<{
    driverName: string;
    active: string;
    title?: string;
    subtitle?: string;
    back?: string;
    action?: ReactNode;
}>) {
    const { t } = useTranslation();
    const { props } = usePage<{ appName?: string }>();

    const tabs: Tab[] = [
        { key: 'home', href: route('distribution.driver.home'), label: t('Home'), icon: Home },
        { key: 'round', href: route('distribution.driver.round'), label: t('Round'), icon: RouteIcon },
        { key: 'stock', href: route('distribution.driver.stock'), label: t('Stock'), icon: Package },
        { key: 'debts', href: route('distribution.driver.debts'), label: t('Debts'), icon: CreditCard },
        { key: 'more', href: route('distribution.driver.more'), label: t('More'), icon: MoreHorizontal },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
            <header className="sticky top-0 z-40 border-b bg-background px-4 py-2.5">
                <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate font-bold leading-tight text-gray-900 dark:text-white">
                            {(props as any).appName ?? 'DzERP'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{driverName}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                        <Link
                            href={route('distribution.driver.printer')}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
                            aria-label={t('Printer')}
                        >
                            <Printer className="h-4 w-4" />
                        </Link>
                        <GpsButton />
                        <button
                            type="button"
                            onClick={() => router.reload()}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
                            aria-label={t('Refresh')}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => router.post(route('distribution.driver.logout'))}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
                            aria-label={t('Sign out')}
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            {(title || back) && (
                <div className="border-b bg-background px-4 py-3">
                    <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            {back && (
                                <Link
                                    href={back}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent rtl:rotate-180"
                                    aria-label={t('Back')}
                                >
                                    {/* Rotated for RTL so the arrow always points "back". */}
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m12 19-7-7 7-7" />
                                        <path d="M19 12H5" />
                                    </svg>
                                </Link>
                            )}
                            <div className="min-w-0">
                                {title && <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{title}</h1>}
                                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
                            </div>
                        </div>
                        {action}
                    </div>
                </div>
            )}

            {/* Padded for the fixed tab bar so the last row is never trapped under it. */}
            <main className="mx-auto w-full max-w-lg flex-1 p-4 pb-24">{children}</main>

            <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background">
                <div className="mx-auto grid max-w-lg grid-cols-5">
                    {tabs.map((tab) => {
                        const isActive = tab.key === active;

                        return (
                            <Link
                                key={tab.key}
                                href={tab.href}
                                className={cn(
                                    'flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors',
                                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                )}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <tab.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
