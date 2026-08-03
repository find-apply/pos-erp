import { FormEventHandler } from 'react';
import { Link, useForm } from '@inertiajs/react';
import { Truck, Mail, Lock, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CompactAuthLayout from '@/layouts/auth/compact-auth-layout';
import { Field, GradientButton } from '@/components/auth/field';

export default function DriverLogin() {
    const { t } = useTranslation();

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('driver.login'));
    };

    return (
        <CompactAuthLayout
            head={t('Livreur login')}
            subtitle={t('Connexion livreur')}
            icon={<Truck className="h-7 w-7" />}
        >
            <form onSubmit={submit} className="space-y-4">
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
                    autoFocus
                />

                <Field
                    id="password"
                    label={t('Password')}
                    icon={<Lock className="h-4 w-4" />}
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    revealable
                    required
                />

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        {t('Remember me')}
                    </label>

                    <Link
                        href={route('password.request')}
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                        {t('Forgot password?')}
                    </Link>
                </div>

                <GradientButton type="submit" loading={processing} data-test="driver-login-button">
                    {t('Se connecter')}
                </GradientButton>

                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('No livreur account?')}{' '}
                    <Link
                        href={route('driver.register')}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                        {t("S'inscrire")}
                    </Link>
                </p>

                <div className="border-t border-gray-100 pt-4 dark:border-slate-800">
                    <Link
                        href={route('login')}
                        className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <Building2 className="h-4 w-4" />
                        {t('Company login')}
                    </Link>
                </div>
            </form>
        </CompactAuthLayout>
    );
}
