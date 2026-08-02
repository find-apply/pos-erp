import { Truck } from 'lucide-react';

declare global {
    function route(name: string, params?: any): string;
}

export const fleetTrackingCompanyMenu = (t: (key: string) => string) => [
    {
        title: t('Fleet Management'),
        icon: Truck,
        permission: 'manage-vehicles',
        order: 440,
        children: [
            {
                title: t('Fleet Tracking'),
                href: route('fleet-tracking.index'),
                permission: 'view-fleet-map',
            },
            {
                title: t('Fleet Settings'),
                href: route('fleet-tracking.settings'),
                permission: 'manage-vehicles',
            },
        ],
    },
];
