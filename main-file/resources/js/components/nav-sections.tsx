import { Link, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavItem } from '@/types';
import { groupIntoSections, SECTION_LABELS } from '@/utils/menu-sections';
import { cn } from '@/lib/utils';

/**
 * Grouped sidebar navigation.
 *
 * Renders the menu as labelled sections (COMMERCE, DISTRIBUTION, ...) with a
 * flat, high-contrast active state, replacing the single undifferentiated
 * list. Collapses to icons alongside the sidebar's `collapsible="icon"` mode.
 */
export function NavSections({ items = [], searchQuery = '' }: { items: NavItem[]; searchQuery?: string }) {
    const page = usePage();
    const { t } = useTranslation();
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

    const currentPath = page.url.split('?')[0];

    const toPath = (href?: string) => {
        if (!href) return '';
        try {
            return href.startsWith('http') ? new URL(href).pathname : href;
        } catch {
            return href;
        }
    };

    /** Every path an entry can claim: its own href plus any extra activePaths. */
    const itemPaths = (item: NavItem): string[] =>
        [item.href, ...(item.activePaths ?? [])].map(toPath).filter(Boolean);

    /**
     * How well a path claims the current URL: its length when it matches
     * exactly or as a parent segment, 0 otherwise.
     */
    const matchLength = (path: string): number =>
        currentPath === path || currentPath.startsWith(path + '/') ? path.length : 0;

    /**
     * The deepest claim any entry makes on this URL. Prefix matching keeps
     * detail pages (/distribution/rounds/12) highlighting their list entry,
     * but without picking a single winner /distribution would light up
     * alongside /distribution/drivers, since both prefix-match.
     */
    const bestMatch = useMemo(() => {
        let best = 0;
        const walk = (list: NavItem[]) =>
            list.forEach((item) => {
                itemPaths(item).forEach((p) => {
                    best = Math.max(best, matchLength(p));
                });
                walk(item.children ?? []);
            });
        walk(items);
        return best;
    }, [items, currentPath]);

    const isActive = (item: NavItem): boolean =>
        bestMatch > 0 && itemPaths(item).some((p) => matchLength(p) === bestMatch);

    const hasActiveChild = (item: NavItem): boolean =>
        (item.children ?? []).some((child) => isActive(child) || hasActiveChild(child));

    const matches = (item: NavItem, q: string): boolean => {
        if (!q) return true;
        if (item.title.toLowerCase().includes(q.toLowerCase())) return true;
        return (item.children ?? []).some((c) => matches(c, q));
    };

    const visible = items.filter((item) => matches(item, searchQuery));

    // GENERAL is platform-level housekeeping, kept out of the company sidebar.
    // Settings still reaches it from the avatar menu, so nothing is stranded.
    const isSuperAdmin = ((page.props as any)?.auth?.user?.roles ?? []).includes('superadmin');
    const sections = groupIntoSections(visible).filter(
        (section) => isSuperAdmin || section.key !== 'GENERAL'
    );

    const itemClasses = (active: boolean) =>
        cn(
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
            active
                ? 'bg-blue-500 font-medium text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800',
        );

    return (
        <nav className="space-y-5 px-2 py-2">
            {sections.map(({ key, items: sectionItems }) => (
                <div key={key}>
                    <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 group-data-[collapsible=icon]:hidden dark:text-gray-500">
                        {t(SECTION_LABELS[key])}
                    </p>

                    <div className="space-y-0.5">
                        {sectionItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item);
                            const childActive = hasActiveChild(item);
                            const children = item.children ?? [];

                            // Leaf item.
                            if (children.length === 0) {
                                return (
                                    <Link
                                        key={item.title}
                                        href={item.href ?? '#'}
                                        className={itemClasses(active)}
                                    >
                                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                                        <span className="truncate group-data-[collapsible=icon]:hidden">
                                            {item.title}
                                        </span>
                                    </Link>
                                );
                            }

                            // Parent with children - open when a child is active.
                            const isOpen = openGroups[item.title] ?? childActive;

                            return (
                                <div key={item.title}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenGroups((g) => ({ ...g, [item.title]: !isOpen }))
                                        }
                                        className={cn(itemClasses(false), childActive && 'text-blue-600 dark:text-blue-400')}
                                        aria-expanded={isOpen}
                                    >
                                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                                        <span className="flex-1 truncate text-start group-data-[collapsible=icon]:hidden">
                                            {item.title}
                                        </span>
                                        <ChevronDown
                                            className={cn(
                                                'h-3.5 w-3.5 shrink-0 transition-transform group-data-[collapsible=icon]:hidden',
                                                isOpen && 'rotate-180',
                                            )}
                                        />
                                    </button>

                                    {isOpen && (
                                        <div className="mt-0.5 space-y-0.5 border-s border-gray-100 ps-3 ms-4 group-data-[collapsible=icon]:hidden dark:border-slate-800">
                                            {children.map((child) => (
                                                <Link
                                                    key={child.title}
                                                    href={child.href ?? '#'}
                                                    className={cn(
                                                        'block truncate rounded-lg px-3 py-1.5 text-sm transition-colors',
                                                        isActive(child)
                                                            ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                                            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800',
                                                    )}
                                                >
                                                    {child.title}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
}
