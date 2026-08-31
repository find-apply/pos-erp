import { FormEvent } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Key, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';

declare global {
    function route(name: string, params?: any): string;
}

type Props = { prefilled_code: string };

/**
 * Driver sign-in. Reached by scanning the QR on the driver card, which fills
 * in the access code and leaves the phone number to be entered.
 */
export default function DriverAccess() {
    const { t } = useTranslation();
    const { prefilled_code: prefilledCode } = usePage<Props>().props;

    const form = useForm({
        phone: '',
        access_code: prefilledCode ?? '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(route('distribution.driver.access.login'));
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
            <Head title={t('Driver sign-in')} />

            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 flex flex-col items-center gap-2 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Truck className="h-6 w-6 text-primary" />
                    </span>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('Driver sign-in')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Enter your phone number and your access code')}
                    </p>
                </div>

                <form onSubmit={submit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="phone">{t('Phone')}</Label>
                        <Input
                            id="phone"
                            inputMode="tel"
                            autoComplete="tel"
                            value={form.data.phone}
                            onChange={(event) => form.setData('phone', event.target.value)}
                            placeholder="0555 XX XX XX"
                        />
                        <InputError message={form.errors.phone} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="access_code" className="flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            {t('Access code')}
                        </Label>
                        <Input
                            id="access_code"
                            inputMode="numeric"
                            maxLength={6}
                            className="text-center font-mono text-2xl tracking-[0.4em]"
                            value={form.data.access_code}
                            onChange={(event) => form.setData('access_code', event.target.value.replace(/\D/g, ''))}
                            placeholder="123456"
                        />
                        <InputError message={form.errors.access_code} />
                    </div>

                    <Button
                        type="submit"
                        className="h-11 w-full"
                        disabled={form.processing || form.data.access_code.length !== 6 || !form.data.phone}
                    >
                        {t('Sign in')}
                    </Button>
                </form>
            </div>
        </div>
    );
}
