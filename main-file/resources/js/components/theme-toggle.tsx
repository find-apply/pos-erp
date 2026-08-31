import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Light/dark switch for the topbar.
 *
 * Renders a placeholder until mounted - the resolved theme is unknown during
 * SSR/hydration, and swapping the icon afterwards causes a mismatch warning.
 */
export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = resolvedTheme === 'dark';

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={t(isDark ? 'Switch to light mode' : 'Switch to dark mode')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
            {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
    );
}
