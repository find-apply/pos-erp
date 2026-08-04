import { type ReactNode, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/*
|--------------------------------------------------------------------------
| Page kit
|--------------------------------------------------------------------------
|
| The shared building blocks every restyled page uses, so the app reads as
| one system instead of 106 individually styled screens.
|
| Visual language (matched to the Dinatek/Dolisoft reference):
|   surface   white / slate-900,  rounded-xl, border, no heavy shadow
|   accent    blue-500 -> orange-500 gradient, used sparingly
|   text      gray-900 titles, gray-500 supporting copy
|   numbers   always dir="ltr" so amounts do not mirror under RTL
|
*/

/**
 * Amounts and counts must not mirror in Arabic - always wrap them.
 *
 * For money, format with `formatCurrency` from @/utils/helpers (it already
 * honours the company's symbol, position and spacing settings) and pass the
 * result through here:  <Num>{formatCurrency(total, pageProps)}</Num>
 */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <span dir="ltr" className={cn('inline-block', className)}>
            {children}
        </span>
    );
}

interface PageHeaderProps {
    title: string;
    /** Supporting line under the title. */
    description?: string;
    /** Buttons rendered on the far side of the header. */
    actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{title}</h1>
                {description && (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

interface KpiCardProps {
    label: string;
    value: ReactNode;
    icon?: ReactNode;
    /** Tailwind colour stem for the icon tile, e.g. "blue" | "orange". */
    tone?: 'blue' | 'orange' | 'green' | 'red' | 'gray';
    hint?: string;
}

const TONES: Record<NonNullable<KpiCardProps['tone']>, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400',
};

export function KpiCard({ label, value, icon, tone = 'blue', hint }: KpiCardProps) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                        <Num>{value}</Num>
                    </p>
                    {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
                </div>
                {icon && (
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
                        {icon}
                    </span>
                )}
            </div>
        </div>
    );
}

/** Responsive KPI row - the strip that opens most Dinatek screens. */
export function KpiRow({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
    const grid = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols];
    return <div className={cn('mb-6 grid grid-cols-1 gap-3', grid)}>{children}</div>;
}

interface SectionCardProps {
    title?: string;
    description?: string;
    actions?: ReactNode;
    /** Remove inner padding when embedding a full-bleed table. */
    flush?: boolean;
    className?: string;
    children: ReactNode;
}

export function SectionCard({ title, description, actions, flush, className, children }: SectionCardProps) {
    return (
        <div
            className={cn(
                'rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                className,
            )}
        >
            {(title || actions) && (
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-slate-800">
                    <div>
                        {title && (
                            <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
                        )}
                        {description && (
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
                        )}
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={flush ? '' : 'p-4'}>{children}</div>
        </div>
    );
}

export function EmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            {icon && <span className="mb-1 text-gray-300 dark:text-slate-700">{icon}</span>}
            <p className="font-medium text-gray-600 dark:text-gray-300">{title}</p>
            {description && (
                <p className="max-w-sm text-sm text-gray-400 dark:text-gray-500">{description}</p>
            )}
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}

/** Wide content (tables, charts) must scroll inside its own box, never the page. */
export function ScrollX({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('w-full overflow-x-auto', className)}>{children}</div>;
}

type ButtonTone = 'primary' | 'ghost' | 'outline';

const BUTTON_TONES: Record<ButtonTone, string> = {
    primary:
        'bg-gradient-to-r from-blue-500 to-orange-500 text-white shadow-sm hover:shadow-md',
    outline:
        'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800',
    ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800',
};

export function ActionButton({
    tone = 'outline',
    icon,
    children,
    className,
    ...props
}: ComponentProps<'button'> & { tone?: ButtonTone; icon?: ReactNode }) {
    return (
        <button
            {...props}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60',
                BUTTON_TONES[tone],
                className,
            )}
        >
            {icon}
            {children}
        </button>
    );
}

const BADGE_TONES = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300',
};

export function StatusBadge({
    tone = 'gray',
    children,
}: {
    tone?: keyof typeof BADGE_TONES;
    children: ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                BADGE_TONES[tone],
            )}
        >
            {children}
        </span>
    );
}
