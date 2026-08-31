import { Car } from 'lucide-react';

declare global {
    function route(name: string, params?: any): string;
}

/**
 * Only the vehicle list is exposed in the sidebar.
 *
 * The live vehicle map duplicated the Distribution Map, so `fleet-tracking.index`
 * has no entry of its own. This points at the vehicle registry, which is the
 * page people actually come here for; the intake configuration sits behind a
 * header button on it, and has no sidebar entry of its own.
 *
 * `fleet-tracking` is mapped to DISTRIBUTION in `menu-sections.ts`, so this lands
 * in the same section as the rest of the distribution items. Order 450 follows
 * Rounds (440); Warehouses (420) and Transfers (430) come from the core menu.
 *
 * To restore the map, add an entry pointing at `fleet-tracking.index` with the
 * `view-fleet-map` permission and order 455.
 */
export const fleetTrackingCompanyMenu = (t: (key: string) => string) => [
    {
        title: t('Vehicles'),
        href: route('fleet-tracking.vehicles.index'),
        icon: Car,
        permission: 'manage-vehicles',
        order: 450,
    },
];
