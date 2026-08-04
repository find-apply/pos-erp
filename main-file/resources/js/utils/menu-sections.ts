import { NavItem } from '@/types';

/**
 * Sidebar sections.
 *
 * The menu itself is assembled from core + package + custom menus, none of
 * which know about grouping. This maps each top-level entry onto a labelled
 * section so the sidebar can render grouped headings instead of one flat list.
 *
 * Matching is tried in order: `name`, then the module/package name, then the
 * untranslated title. Anything unmatched falls into GENERAL, so a newly
 * installed package still appears rather than silently vanishing.
 */

export const SECTION_ORDER = [
    'COMMERCE',
    'DISTRIBUTION',
    'PRODUCTION',
    'FINANCE',
    'RESOURCES',
    'GENERAL',
] as const;

export type SectionKey = (typeof SECTION_ORDER)[number];

/** Translation keys for the section headings. */
export const SECTION_LABELS: Record<SectionKey, string> = {
    COMMERCE: 'Commerce',
    DISTRIBUTION: 'Distribution',
    PRODUCTION: 'Production',
    FINANCE: 'Finance',
    RESOURCES: 'Resources',
    GENERAL: 'General',
};

const RULES: Record<string, SectionKey> = {
    // COMMERCE
    dashboard: 'COMMERCE',
    proposal: 'COMMERCE',
    'sales-invoice': 'COMMERCE',
    sales: 'COMMERCE',
    purchase: 'COMMERCE',
    pos: 'COMMERCE',
    Pos: 'COMMERCE',
    ProductService: 'COMMERCE',
    Quotation: 'COMMERCE',

    // DISTRIBUTION
    FleetTracking: 'DISTRIBUTION',
    'fleet-tracking': 'DISTRIBUTION',

    // FINANCE
    Zakat: 'FINANCE',
    zakat: 'FINANCE',
    Account: 'FINANCE',
    account: 'FINANCE',
    DoubleEntry: 'FINANCE',
    BudgetPlanner: 'FINANCE',

    // RESOURCES
    'user-management': 'RESOURCES',
    users: 'RESOURCES',
    roles: 'RESOURCES',
    Hrm: 'RESOURCES',
    hrm: 'RESOURCES',
    Recruitment: 'RESOURCES',
    Performance: 'RESOURCES',
    Training: 'RESOURCES',
    Timesheet: 'RESOURCES',

    // GENERAL
    'media-library': 'GENERAL',
    messenger: 'GENERAL',
    helpdesk: 'GENERAL',
    SupportTicket: 'GENERAL',
    settings: 'GENERAL',
    Calendar: 'GENERAL',
    FormBuilder: 'GENERAL',
    Contract: 'GENERAL',
    Goal: 'GENERAL',
};

/**
 * Path fragments mapped to sections.
 *
 * Only `dashboard` carries a stable `name` in the menu definitions and titles
 * are translated at build time, so the reliable anchor is the route path. A
 * parent with no href of its own is classified by its first child's path.
 */
const PATH_RULES: Array<[string, SectionKey]> = [
    ['/dashboard', 'COMMERCE'],
    ['/sales-proposal', 'COMMERCE'],
    ['/sales-invoice', 'COMMERCE'],
    ['/sales-return', 'COMMERCE'],
    ['/purchase', 'COMMERCE'],
    ['/quotation', 'COMMERCE'],
    ['/pos', 'COMMERCE'],
    ['/product', 'COMMERCE'],

    ['/fleet-tracking', 'DISTRIBUTION'],
    ['/warehouse', 'DISTRIBUTION'],
    ['/transfer', 'DISTRIBUTION'],

    ['/production', 'PRODUCTION'],
    ['/atelier', 'PRODUCTION'],

    ['/zakat', 'FINANCE'],
    ['/account', 'FINANCE'],
    ['/double-entry', 'FINANCE'],
    ['/budget', 'FINANCE'],

    ['/users', 'RESOURCES'],
    ['/roles', 'RESOURCES'],
    ['/hrm', 'RESOURCES'],
    ['/employee', 'RESOURCES'],
];

function pathOf(href?: string): string {
    if (!href) return '';
    try {
        return href.startsWith('http') ? new URL(href).pathname : href;
    } catch {
        return href;
    }
}

export function sectionFor(item: NavItem): SectionKey {
    // Explicit wins.
    for (const candidate of [item.section, item.name, (item as { module?: string }).module]) {
        if (candidate && RULES[candidate]) return RULES[candidate];
    }

    // Then the item's own path, then its first child's.
    const paths = [pathOf(item.href), ...(item.children ?? []).map((c) => pathOf(c.href))];

    for (const path of paths) {
        if (!path) continue;
        const hit = PATH_RULES.find(([fragment]) => path.startsWith(fragment));
        if (hit) return hit[1];
    }

    return 'GENERAL';
}

/**
 * Bucket menu items into ordered sections, dropping any section that ends up
 * empty for this user's permissions.
 */
export function groupIntoSections(items: NavItem[]): Array<{ key: SectionKey; items: NavItem[] }> {
    const buckets = new Map<SectionKey, NavItem[]>();

    for (const item of items) {
        const key = sectionFor(item);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(item);
    }

    return SECTION_ORDER.filter((key) => (buckets.get(key)?.length ?? 0) > 0).map((key) => ({
        key,
        items: buckets.get(key)!,
    }));
}
