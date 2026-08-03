import { type PropsWithChildren, type ReactNode } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useBrand, BrandProvider } from '@/contexts/brand-context';
import { useFavicon } from '@/hooks/use-favicon';
import { useFlashMessages } from '@/hooks/useFlashMessages';
import CookieConsent from '@/components/cookie-consent';

interface CompactAuthLayoutProps {
    /** Browser tab title. */
    head: string;
    /** Small line under the brand name, e.g. "Connexion". */
    subtitle: string;
    /** Icon rendered inside the gradient tile above the brand name. */
    icon: ReactNode;
    /** Widen the card for the registration module picker. */
    wide?: boolean;
}

/**
 * Single centred card on a soft gradient - the compact shell used by the
 * company and livreur auth screens. Everything is flex-based rather than
 * absolutely positioned so it mirrors correctly under RTL.
 */
export default function CompactAuthLayout(props: PropsWithChildren<CompactAuthLayoutProps>) {
    useFlashMessages();

    return (
        <BrandProvider>
            <CompactAuthShell {...props} />
        </BrandProvider>
    );
}

function CompactAuthShell({
    children,
    head,
    subtitle,
    icon,
    wide = false,
}: PropsWithChildren<CompactAuthLayoutProps>) {
    const { settings } = useBrand();
    const { adminAllSetting } = usePage().props as any;
    useFavicon();

    const brandName = settings?.titleText || 'DzERP';

    return (
        <div className="relative min-h-screen overflow-hidden bg-gray-50 dark:bg-slate-950">
            <Head title={head} />

            {/* Soft corner washes */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-orange-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />
                <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-500/10" />
                <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl dark:bg-blue-500/10" />
            </div>

            <div className="absolute end-4 top-4 z-20">
                <LanguageSwitcher />
            </div>

            <div className="relative z-10 flex min-h-screen items-center justify-center p-4 py-10">
                <div
                    className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900`}
                >
                    <div className="mb-6 flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-orange-500 text-white shadow-sm">
                            {icon}
                        </div>
                        <h1 className="text-2xl font-bold tracking-wide text-gray-900 dark:text-white">
                            {brandName.toUpperCase()}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
                    </div>

                    {children}
                </div>
            </div>

            <CookieConsent settings={adminAllSetting || {}} />
        </div>
    );
}
