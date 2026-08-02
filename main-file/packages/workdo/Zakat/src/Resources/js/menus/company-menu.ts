import { Calculator } from 'lucide-react';

declare global {
    function route(name: string, params?: any): string;
}

export const zakatCompanyMenu = (t: (key: string) => string) => [
    {
        title: t('Zakat'),
        href: route('zakat.index'),
        icon: Calculator,
        permission: 'manage-zakat',
        order: 430,
    },
];
