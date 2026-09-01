import { FormEvent, useMemo, useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Eraser, MapPin, Navigation, PackageCheck, PenTool, Printer } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, StatusBadge } from '@/components/ui/page-kit';
import { formatCurrency } from '@/utils/helpers';
import { DeliveryReceipt, readPaperFormat, ReceiptNote } from '../../Components/DeliveryReceipt';
import { DriverShell } from '../../Components/DriverShell';
import { NOTE_TONES, noteStatusLabel } from '../../lib/status';

declare global {
    function route(name: string, params?: any): string;
}

type Note = ReceiptNote & {
    scheduled_date: string | null;
    latitude: number | null;
    longitude: number | null;
};

type Props = {
    driver: { id: number; name: string; code: string; cash_balance: number; allow_credit: boolean };
    notes: Note[];
    round: { reference: string; stops_total: number; stops_done: number } | null;
};

const OPEN = ['pending', 'assigned', 'in_transit'];

function CompleteDialog({ note, allowCredit, onClose }: { note: Note; allowCredit: boolean; onClose: () => void }) {
    const { t } = useTranslation();

    const signatureRef = useRef<SignatureCanvas>(null);

    const form = useForm({
        status: 'delivered',
        // Full payment is the common case, so it starts filled in.
        collected_amount: note.total_amount,
        recipient_name: note.recipient_name ?? '',
        failure_reason: '',
        signature_data: '',
    });

    const isFailed = form.data.status === 'failed';

    const submit = (event: FormEvent) => {
        event.preventDefault();

        // An untouched pad means no signature was given, which is allowed -
        // sending a blank canvas would store a meaningless image.
        const signature =
            !isFailed && signatureRef.current && !signatureRef.current.isEmpty()
                ? signatureRef.current.toDataURL()
                : '';

        // transform() stores the callback and returns nothing, so it cannot be
        // chained - the request has to be its own statement.
        form.transform((data) => ({ ...data, signature_data: signature }));

        form.put(route('distribution.driver.notes.complete', note.id), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{note.reference ?? `#${note.id}`}</DialogTitle>
                        <DialogDescription>
                            {t('Amount')}: {formatCurrency(note.total_amount)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>{t('Outcome')}</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'delivered', label: t('Delivered') },
                                    { value: 'partial', label: t('Partial') },
                                    { value: 'failed', label: t('Failed') },
                                ].map((option) => (
                                    <Button
                                        key={option.value}
                                        type="button"
                                        variant={form.data.status === option.value ? 'default' : 'outline'}
                                        onClick={() => {
                                            form.setData('status', option.value);
                                            if (option.value === 'failed') form.setData('collected_amount', 0);
                                            if (option.value === 'delivered') form.setData('collected_amount', note.total_amount);
                                        }}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {!isFailed && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="collected">{t('Amount collected')}</Label>
                                    <Input
                                        id="collected"
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        max={note.total_amount}
                                        step="0.01"
                                        value={form.data.collected_amount}
                                        onChange={(event) => form.setData('collected_amount', Number(event.target.value))}
                                    />
                                    <InputError message={form.errors.collected_amount} />
                                    {!allowCredit && form.data.collected_amount < note.total_amount && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            {t('This driver is not allowed to sell on credit.')}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="recipient">{t('Received by')}</Label>
                                    <Input
                                        id="recipient"
                                        value={form.data.recipient_name}
                                        onChange={(event) => form.setData('recipient_name', event.target.value)}
                                        placeholder={t('Name of the person receiving')}
                                    />
                                    <InputError message={form.errors.recipient_name} />
                                </div>

                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2">
                                            <PenTool className="h-4 w-4" />
                                            {t('Signature')}
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => signatureRef.current?.clear()}
                                        >
                                            <Eraser className="me-2 h-4 w-4" />
                                            {t('Clear')}
                                        </Button>
                                    </div>
                                    <div className="overflow-hidden rounded-lg border bg-white">
                                        <SignatureCanvas
                                            ref={signatureRef}
                                            penColor="#111827"
                                            canvasProps={{ className: 'h-32 w-full' }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('Have the recipient sign - optional')}
                                    </p>
                                </div>
                            </>
                        )}

                        {isFailed && (
                            <div className="grid gap-2">
                                <Label htmlFor="reason">{t('Reason')}</Label>
                                <Textarea
                                    id="reason"
                                    value={form.data.failure_reason}
                                    onChange={(event) => form.setData('failure_reason', event.target.value)}
                                    placeholder={t('Why could this not be delivered?')}
                                />
                                <InputError message={form.errors.failure_reason} />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {t('Save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function DriverRound() {
    const { t } = useTranslation();
    const page = usePage<Props & { appName?: string }>();
    const { driver, notes, round } = page.props;
    const company = (page.props as any).appName ?? 'DzERP';
    const [completing, setCompleting] = useState<Note | null>(null);
    const [printing, setPrinting] = useState<Note | null>(null);

    // The receipt must be in the DOM before the print dialog opens, so the
    // print is deferred a frame past the state update that mounts it.
    const printReceipt = (note: Note) => {
        setPrinting(note);
        requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    };

    const open = useMemo(() => notes.filter((note) => OPEN.includes(note.status)), [notes]);
    const done = useMemo(() => notes.filter((note) => !OPEN.includes(note.status)), [notes]);

    return (
        <DriverShell
            driverName={driver.name}
            active="round"
            title={t('My round')}
            subtitle={round ? `${round.reference} · ${round.stops_done}/${round.stops_total}` : t('No round scheduled')}
        >
            <Head title={t('My round')} />

            <div className="space-y-4">
                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-muted-foreground">
                        {t('To deliver')} ({open.length})
                    </h2>

                    {open.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                            <EmptyState icon={<PackageCheck className="h-8 w-8" />} title={t('Nothing left to deliver')} />
                        </div>
                    ) : (
                        open.map((note) => (
                            <article
                                key={note.id}
                                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {note.reference ?? `#${note.id}`}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{formatCurrency(note.total_amount)}</p>
                                    </div>
                                    <StatusBadge tone={NOTE_TONES[note.status] ?? 'gray'}>
                                        {noteStatusLabel(note.status, t)}
                                    </StatusBadge>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {note.latitude !== null && note.longitude !== null && (
                                        <Button asChild variant="outline" size="sm">
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${note.latitude}&mlon=${note.longitude}#map=17/${note.latitude}/${note.longitude}`}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <Navigation className="me-2 h-4 w-4" />
                                                {t('Navigate')}
                                            </a>
                                        </Button>
                                    )}
                                    {note.status !== 'in_transit' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                router.put(
                                                    route('distribution.driver.notes.transit', note.id),
                                                    {},
                                                    { preserveScroll: true }
                                                )
                                            }
                                        >
                                            <MapPin className="me-2 h-4 w-4" />
                                            {t('Start')}
                                        </Button>
                                    )}
                                    <Button size="sm" onClick={() => setCompleting(note)}>
                                        <PackageCheck className="me-2 h-4 w-4" />
                                        {t('Complete')}
                                    </Button>
                                </div>
                            </article>
                        ))
                    )}
                </section>

                {done.length > 0 && (
                    <section className="space-y-2">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            {t('Done')} ({done.length})
                        </h2>
                        {done.map((note) => (
                            <article
                                key={note.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-gray-900 dark:text-white">
                                        {note.reference ?? `#${note.id}`}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {formatCurrency(note.collected_amount)} / {formatCurrency(note.total_amount)}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <StatusBadge tone={NOTE_TONES[note.status] ?? 'gray'}>
                                        {noteStatusLabel(note.status, t)}
                                    </StatusBadge>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => printReceipt(note)}
                                        aria-label={t('Print the receipt')}
                                    >
                                        <Printer className="h-4 w-4" />
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </div>

            {printing && (
                <DeliveryReceipt
                    note={printing}
                    company={company}
                    driverName={driver.name}
                    format={readPaperFormat()}
                />
            )}

            {completing && (
                <CompleteDialog
                    note={completing}
                    allowCredit={driver.allow_credit}
                    onClose={() => setCompleting(null)}
                />
            )}
        </DriverShell>
    );
}
