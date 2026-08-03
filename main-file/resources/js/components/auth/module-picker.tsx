import { Check, ShoppingCart, Truck, Users, Calculator, UserCog, Briefcase, Headphones, type LucideIcon } from 'lucide-react';

export interface ModuleCard {
    key: string;
    name: string;
    description: string;
    icon: string;
    base: boolean;
    group: string | null;
    monthly_price: number;
    yearly_price: number;
    free_months: number;
    modules: string[];
    driver_limit: number | null;
}

const ICONS: Record<string, LucideIcon> = {
    'shopping-cart': ShoppingCart,
    truck: Truck,
    users: Users,
    calculator: Calculator,
    'user-cog': UserCog,
    briefcase: Briefcase,
    headphones: Headphones,
};

export const formatPrice = (value: number, currency: string) =>
    `${value.toLocaleString('en-US')} ${currency}`;

interface ModulePickerProps {
    cards: ModuleCard[];
    selected: string[];
    currency: string;
    onToggle: (key: string) => void;
}

/**
 * The "Modules à activer" list. Base cards are locked on; cards sharing a
 * `group` behave as mutually exclusive tiers, which the parent enforces when
 * it handles onToggle.
 */
export function ModulePicker({ cards, selected, currency, onToggle }: ModulePickerProps) {
    return (
        <div className="space-y-2">
            {cards.map((card) => {
                const Icon = ICONS[card.icon] ?? ShoppingCart;
                const isSelected = selected.includes(card.key);
                const isLocked = card.base;

                return (
                    <button
                        type="button"
                        key={card.key}
                        onClick={() => !isLocked && onToggle(card.key)}
                        aria-pressed={isSelected}
                        disabled={isLocked}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-all ${
                            isSelected
                                ? 'border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-500/10'
                                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-slate-700 dark:bg-slate-900'
                        } ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                        <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                isSelected
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'
                            }`}
                        >
                            <Icon className="h-5 w-5" />
                        </span>

                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-gray-900 dark:text-white">
                                {card.name}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                                {card.description}
                            </span>
                            {/* Prices stay LTR so the currency and number do not
                                get mirrored when the app runs in Arabic. */}
                            <span
                                dir="ltr"
                                className="mt-0.5 block text-xs font-medium text-blue-600 dark:text-blue-400 rtl:text-right"
                            >
                                {card.base ? '' : '+'}
                                {formatPrice(card.monthly_price, currency)}/mois
                            </span>
                            <span
                                dir="ltr"
                                className="block text-xs text-gray-400 dark:text-gray-500 rtl:text-right"
                            >
                                {formatPrice(card.yearly_price, currency)}/an
                                {card.free_months > 0 &&
                                    ` (${card.free_months} mois gratuit${card.free_months > 1 ? 's' : ''})`}
                            </span>
                        </span>

                        <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                isSelected
                                    ? 'border-blue-500 bg-blue-500 text-white'
                                    : 'border-gray-300 dark:border-slate-600'
                            }`}
                        >
                            {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
