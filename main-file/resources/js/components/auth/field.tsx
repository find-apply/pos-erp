import { useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import InputError from '@/components/ui/input-error';

interface FieldProps extends Omit<ComponentProps<'input'>, 'className'> {
    label: string;
    icon: ReactNode;
    error?: string;
    /** Renders the show/hide toggle and swaps the input type. */
    revealable?: boolean;
}

/**
 * Labelled input with a leading icon. The icon sits in the flex row rather
 * than being absolutely positioned, so the layout mirrors under RTL without
 * needing direction-specific padding.
 */
export function Field({ label, icon, error, revealable = false, type = 'text', ...props }: FieldProps) {
    const [revealed, setRevealed] = useState(false);
    const resolvedType = revealable ? (revealed ? 'text' : 'password') : type;

    return (
        <div className="space-y-1.5">
            <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {label}
            </label>

            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 transition-colors focus-within:border-blue-400 focus-within:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus-within:bg-slate-800">
                <span className="shrink-0 text-gray-400 dark:text-gray-500">{icon}</span>

                <input
                    {...props}
                    type={resolvedType}
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                />

                {revealable && (
                    <button
                        type="button"
                        onClick={() => setRevealed((v) => !v)}
                        className="shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                        tabIndex={-1}
                        aria-label={revealed ? 'Hide password' : 'Show password'}
                    >
                        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                )}
            </div>

            <InputError message={error} />
        </div>
    );
}

/** Full-width gradient submit button. */
export function GradientButton({
    children,
    loading = false,
    ...props
}: ComponentProps<'button'> & { loading?: boolean }) {
    return (
        <button
            {...props}
            disabled={loading || props.disabled}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-orange-500 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
            {loading ? '...' : children}
        </button>
    );
}
