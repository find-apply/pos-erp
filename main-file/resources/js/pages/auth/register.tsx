import { FormEventHandler, useMemo } from 'react';
import { Link, useForm } from '@inertiajs/react';
import { Building2, User, Mail, Lock, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CompactAuthLayout from '@/layouts/auth/compact-auth-layout';
import { Field, GradientButton } from '@/components/auth/field';
import { ModulePicker, formatPrice, type ModuleCard } from '@/components/auth/module-picker';

interface RegisterProps {
    moduleCards: ModuleCard[];
    currency: string;
    trialDays: number;
}

export default function Register({ moduleCards = [], currency = 'DA', trialDays = 0 }: RegisterProps) {
    const { t } = useTranslation();

    const baseKeys = useMemo(
        () => moduleCards.filter((c) => c.base).map((c) => c.key),
        [moduleCards],
    );

    const { data, setData, post, processing, errors } = useForm<{
        name: string;
        email: string;
        password: string;
        password_confirmation: string;
        modules: string[];
    }>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        modules: baseKeys,
    });

    /** Selecting a tier deselects its siblings so a group acts like a radio. */
    const toggle = (key: string) => {
        const card = moduleCards.find((c) => c.key === key);
        if (!card || card.base) return;

        if (data.modules.includes(key)) {
            setData('modules', data.modules.filter((k) => k !== key));
            return;
        }

        const siblings = card.group
            ? moduleCards.filter((c) => c.group === card.group).map((c) => c.key)
            : [];

        setData('modules', [...data.modules.filter((k) => !siblings.includes(k)), key]);
    };

    const totals = useMemo(() => {
        return moduleCards
            .filter((c) => data.modules.includes(c.key))
            .reduce(
                (acc, c) => ({
                    monthly: acc.monthly + c.monthly_price,
                    yearly: acc.yearly + c.yearly_price,
                    freeMonths: Math.max(acc.freeMonths, c.free_months),
                }),
                { monthly: 0, yearly: 0, freeMonths: 0 },
            );
    }, [data.modules, moduleCards]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register'));
    };

    return (
        <CompactAuthLayout
            head={t('Register')}
            subtitle={t('Inscription')}
            icon={<Building2 className="h-7 w-7" />}
            wide
        >
            <form onSubmit={submit} className="space-y-4">
                <Field
                    id="name"
                    label={t('Full name')}
                    icon={<User className="h-4 w-4" />}
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={errors.name}
                    placeholder={t('Your full name')}
                    autoComplete="name"
                    required
                    autoFocus
                />

                <Field
                    id="email"
                    type="email"
                    label={t('Email')}
                    icon={<Mail className="h-4 w-4" />}
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    placeholder="email@exemple.com"
                    autoComplete="email"
                    required
                />

                <Field
                    id="password"
                    label={t('Password')}
                    icon={<Lock className="h-4 w-4" />}
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    revealable
                    required
                />

                <Field
                    id="password_confirmation"
                    type="password"
                    label={t('Confirm password')}
                    icon={<Lock className="h-4 w-4" />}
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                />

                {moduleCards.length > 0 && (
                    <div className="space-y-2 pt-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {t('Modules to activate')}
                        </p>

                        <ModulePicker
                            cards={moduleCards}
                            selected={data.modules}
                            currency={currency}
                            onToggle={toggle}
                        />

                        {errors.modules && (
                            <p className="text-xs text-red-600">{errors.modules}</p>
                        )}

                        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-50 to-orange-50 p-4 dark:from-blue-500/10 dark:to-orange-500/10">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('Your plan')}
                                </p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    PRO
                                </p>
                            </div>
                            {/* dir="ltr" keeps the amounts readable under RTL. */}
                            <div dir="ltr" className="text-end">
                                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    {formatPrice(totals.monthly, currency)}
                                    <span className="text-xs font-normal text-gray-500">/mois</span>
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatPrice(totals.yearly, currency)}/an
                                </p>
                                {totals.freeMonths > 0 && (
                                    <p className="text-xs font-medium text-orange-500">
                                        {t('{{count}} months free', { count: totals.freeMonths })}
                                    </p>
                                )}
                            </div>
                        </div>

                        {trialDays > 0 && (
                            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                                <Gift className="h-4 w-4 shrink-0 text-blue-500" />
                                {t('Free trial of {{days}} days for all modules!', { days: trialDays })}
                            </div>
                        )}
                    </div>
                )}

                <GradientButton type="submit" loading={processing} data-test="register-user-button">
                    {t("S'inscrire")}
                </GradientButton>

                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('Already have an account?')}{' '}
                    <Link href={route('login')} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                        {t('Log in')}
                    </Link>
                </p>
            </form>
        </CompactAuthLayout>
    );
}
