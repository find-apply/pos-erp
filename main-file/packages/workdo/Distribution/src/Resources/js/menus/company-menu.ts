import { Route, Truck, Users } from 'lucide-react';

declare global {
    function route(name: string, params?: any): string;
}

/**
 * Distribution sits in its own sidebar section. Each entry is top-level rather
 * than nested, because `groupIntoSections` only buckets top-level items - a
 * child would stay hidden under its parent instead of joining the group.
 *
 * Warehouses (420) and Transfers (430) are core routes and slot between these
 * from the company menu, so the orders below leave gaps for them.
 *
 * The distribution map and the performance report have no entries of their
 * own - both are reached from their cards on the hub. To restore them, add
 * `distribution.map` (`view-distribution-map`, order 455) and
 * `distribution.performance` (`view-distribution-performance`, order 460).
 */
export const distributionCompanyMenu = (t: (key: string) => string) => [
    {
        title: t('Distribution'),
        href: route('distribution.index'),
        icon: Truck,
        permission: 'view-distribution',
        order: 400,
    },
    {
        title: t('Drivers'),
        href: route('distribution.drivers'),
        icon: Users,
        permission: 'manage-distribution-drivers',
        order: 410,
    },
    {
        title: t('Rounds'),
        href: route('distribution.rounds'),
        icon: Route,
        permission: 'manage-delivery-rounds',
        order: 440,
    },
];
