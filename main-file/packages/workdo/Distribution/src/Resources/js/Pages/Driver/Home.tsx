import { FormEvent, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Banknote, CreditCard, Package, Route as RouteIcon, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/helpers';
import { DriverShell } from '../../Components/DriverShell';

declare global {
    function route(name: string, params?: any): string;
}

type Props = {
    driver: { id: number; name: string; code: string; cash_balance: number };
    stock: { items: number; value: number };
    cash_balance: number;
    receivables: { customers: number; total: number };
    round: {
        id: number;
        reference: string;
        status: string;
        stops_total: number;
        stops_done: number;
    } | null;
};

/** One of the four figures on the driver's home screen. */
function Tile({
    icon: Icon,
    tone,
    label,
    value,
    hint,
    href,
    valueClass,
}: {
    icon: any;
    tone: string;
    label: string;
    value: string;
    hint?: string;
    href?: string;
    valueClass?: string;
}) {
    const body = (
        <>
            <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass ?? 'text-gray-900 dark:text-white'}`}>
                {value}
            </p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </>
    );

    const className =
        'block rounded-xl border border-gray-200 bg-white p-4 transition-colors dark:border-slate-800 dark:bg-slate-900';

    return href ? (
        <Link href={href} className={`${className} hover:border-primary/40`}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

function QuickAction({ href, icon: Icon, label, primary }: { href: string; icon: any; label: string; primary?: boolean }) {
    return (
        <Link
            href={href}
            className={
                primary
                    ? 'flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground transition-opacity hover:opacity-90'
                    : 'flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-accent dark:border-slate-800 dark:bg-slate-900'
            }
        >
            <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">{label}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 opacity-60 rtl:-scale-x-100" />
        </Link>
    );
}


/** The driver hands their collected cash in to the office. */
function DepositDialog({ balance, onClose }: { balance: number; onClose: () => void }) {
    const { t } = useTranslation();
    const form = useForm({ amount: balance });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('distribution.driver.deposit'), { preserveScroll: true, onSuccess: onClose });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{t('Hand in cash')}</DialogTitle>
                        <DialogDescription>{formatCurrency(balance)}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2 py-4">
                        <Label htmlFor="amount">{t('Amount handed in')}</Label>
                        <Input
                            id="amount"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={balance}
                            step="0.01"
                            value={form.data.amount}
                            onChange={(event) => form.setData('amount', Number(event.target.value))}
                        />
                        <InputError message={form.errors.amount} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing || form.data.amount <= 0}>
                            {t('Hand in')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function DriverHomePage() {
    const { t } = useTranslation();
    const { driver, stock, cash_balance: cash, receivables, round } = usePage<Props>().props;
    const [depositing, setDepositing] = useState(false);

    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <DriverShell driverName={driver.name} active="home">
            <Head title={t('Home')} />

            <div className="space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {t('Welcome')}, {driver.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">{today}</p>
                </div>

                {round ? (
                    <Link
                        href={route('distribution.driver.round')}
                        className="block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-primary/40 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <RouteIcon className="h-5 w-5 text-primary" />
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{round.reference}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {round.stops_done}/{round.stops_total} {t('stops')}
                                    </p>
                                </div>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground rtl:-scale-x-100" />
                        </div>
                    </Link>
                ) : (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-900">
                        <RouteIcon className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">{t('No round scheduled')}</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Tile
                        icon={Package}
                        tone="text-blue-500"
                        label={t('My stock')}
                        value={formatCurrency(stock.value)}
                        hint={`${stock.items} ${t('items')}`}
                        href={route('distribution.driver.stock')}
                    />
                    <Tile
                        icon={Wallet}
                        tone="text-green-500"
                        label={t('My cash box')}
                        value={formatCurrency(cash)}
                        hint={t('To hand in at the office')}
                    />
                    <Tile
                        icon={CreditCard}
                        tone="text-red-500"
                        label={t('My receivables')}
                        value={formatCurrency(receivables.total)}
                        valueClass={receivables.total > 0 ? 'text-red-600 dark:text-red-400' : undefined}
                        hint={`${receivables.customers} ${t('customers')}`}
                        href={route('distribution.driver.debts')}
                    />
                    <Tile
                        icon={Users}
                        tone="text-purple-500"
                        label={t('My customers')}
                        value={t('Manage')}
                        href={route('distribution.driver.more')}
                    />
                </div>

                <div className="space-y-2 pt-2">
                    <h2 className="text-sm font-medium text-muted-foreground">{t('Quick actions')}</h2>
                    <QuickAction
                        href={route('distribution.driver.round')}
                        icon={RouteIcon}
                        label={t('My round')}
                        primary
                    />
                    <QuickAction href={route('distribution.driver.stock')} icon={Package} label={t('Stock inventory')} />
                    <QuickAction href={route('distribution.driver.debts')} icon={CreditCard} label={t('Collect a debt')} />
                    <button
                        type="button"
                        disabled={cash <= 0}
                        onClick={() => setDepositing(true)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-accent disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <span className="flex items-center gap-2.5">
                            <Banknote className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">{t('Hand in cash')}</span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 opacity-60 rtl:-scale-x-100" />
                    </button>
                </div>
            </div>

            {depositing && <DepositDialog balance={cash} onClose={() => setDepositing(false)} />}
        </DriverShell>
    );
}
