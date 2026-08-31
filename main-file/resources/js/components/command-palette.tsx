import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Search, CornerDownLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NavItem } from '@/types';
import { allMenuItems } from '@/utils/menu';
import { groupIntoSections, SECTION_LABELS, type SectionKey } from '@/utils/menu-sections';
import { cn } from '@/lib/utils';

interface Entry {
    title: string;
    href: string;
    section: SectionKey;
    /** Parent title, so "Sales Invoice > Returns" reads unambiguously. */
    parent?: string;
}

/**
 * Global command palette, opened with Cmd/Ctrl-K.
 *
 * Flattens the permission-filtered menu into jump targets, so it only offers
 * pages the current user can actually reach. Filtering and keyboard handling
 * are implemented here - the ui/command primitives are presentation only.
 */
/**
 * @param variant "bar" is the wide search field for the header on desktop;
 *                "icon" is the compact button shown where there is no room.
 */
export function CommandPalette({ variant = 'bar' }: { variant?: 'bar' | 'icon' } = {}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const menu = allMenuItems();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((v) => !v);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (open) {
            setQuery('');
            setCursor(0);
        }
    }, [open]);

    const entries = useMemo<Entry[]>(() => {
        const flatten = (items: NavItem[], section: SectionKey, parent?: string): Entry[] =>
            items.flatMap((item) => {
                const self = item.href ? [{ title: item.title, href: item.href, section, parent }] : [];
                return [...self, ...flatten(item.children ?? [], section, item.title)];
            });

        return groupIntoSections(menu).flatMap(({ key, items }) => flatten(items, key));
    }, [menu]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter((e) =>
            `${e.parent ?? ''} ${e.title}`.toLowerCase().includes(q),
        );
    }, [entries, query]);

    // Keep the highlighted row in view as the cursor moves.
    useEffect(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [cursor, results.length]);

    const go = (href: string) => {
        setOpen(false);
        router.visit(href);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCursor((c) => (results.length ? (c + 1) % results.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
        } else if (e.key === 'Enter' && results[cursor]) {
            e.preventDefault();
            go(results[cursor].href);
        }
    };

    // Group the flat result list back under section headings for display.
    const sections = useMemo(() => {
        const out: Array<{ key: SectionKey; rows: Array<{ entry: Entry; index: number }> }> = [];
        results.forEach((entry, index) => {
            let bucket = out.find((b) => b.key === entry.section);
            if (!bucket) {
                bucket = { key: entry.section, rows: [] };
                out.push(bucket);
            }
            bucket.rows.push({ entry, index });
        });
        return out;
    }, [results]);

    return (
        <>
            {variant === 'icon' ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={t('Search...')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    <Search className="h-4 w-4" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 truncate text-start">{t('Search...')}</span>
                    <kbd
                        dir="ltr"
                        className="hidden shrink-0 rounded border border-border bg-background px-1.5 font-mono text-[10px] leading-4 text-muted-foreground sm:inline"
                    >
                        ⌘K
                    </kbd>
                </button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-4 dark:border-slate-800">
                        <Search className="h-4 w-4 shrink-0 text-gray-400" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setCursor(0);
                            }}
                            onKeyDown={onKeyDown}
                            placeholder={t('Type a page name...')}
                            className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-gray-400 dark:text-white"
                        />
                    </div>

                    <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
                        {results.length === 0 && (
                            <p className="py-8 text-center text-sm text-gray-400">{t('No results found.')}</p>
                        )}

                        {sections.map(({ key, rows }) => (
                            <div key={key} className="mb-1">
                                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                    {t(SECTION_LABELS[key])}
                                </p>
                                {rows.map(({ entry, index }) => (
                                    <button
                                        type="button"
                                        key={`${entry.href}-${entry.title}`}
                                        data-active={index === cursor}
                                        onMouseEnter={() => setCursor(index)}
                                        onClick={() => go(entry.href)}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm',
                                            index === cursor
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                                : 'text-gray-700 dark:text-gray-300',
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            {entry.parent && <span className="text-gray-400">{entry.parent} › </span>}
                                            {entry.title}
                                        </span>
                                        {index === cursor && (
                                            <CornerDownLeft className="h-3 w-3 shrink-0 text-gray-400" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
