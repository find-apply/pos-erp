import { FormEventHandler } from 'react';
import { Link, useForm } from '@inertiajs/react';
import { Truck, User, Mail, Lock, KeyRound, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CompactAuthLayout from '@/layouts/auth/compact-auth-layout';
import { Field, GradientButton } from '@/components/auth/field';

export default function DriverRegister() {
    const { t } = useTranslation();

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        join_code: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('driver.register'));
    };

    return (
        <CompactAuthLayout
            head={t('Livreur registration')}
            subtitle={t('Inscription livreur')}
            icon={<Truck className="h-7 w-7" />}
        >
            <form onSubmit={submit} className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    {t('Ask your manager for the company fleet code before signing up.')}
                </div>

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
                    id="join_code"
                    label={t('Company code')}
                    icon={<KeyRound className="h-4 w-4" />}
                    value={data.join_code}
                    onChange={(e) => setData('join_code', e.target.value.toUpperCase())}
                    error={errors.join_code}
                    placeholder="ABCD2345"
                    maxLength={12}
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

                <GradientButton type="submit" loading={processing} data-test="driver-register-button">
                    {t("S'inscrire")}
                </GradientButton>

                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('Already have an account?')}{' '}
                    <Link
                        href={route('driver.login')}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                        {t('Se connecter')}
                    </Link>
                </p>
            </form>
        </CompactAuthLayout>
    );
}
