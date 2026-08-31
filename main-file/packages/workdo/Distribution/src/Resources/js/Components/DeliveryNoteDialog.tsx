import { FormEvent, useMemo } from 'react';
import { useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/utils/helpers';

declare global {
    function route(name: string, params?: any): string;
}

export type NoteLine = {
    product_id: number | null;
    description: string | null;
    quantity: number;
    unit_price: number;
};

export type EditableNote = {
    id: number;
    reference: string | null;
    customer_id: number | null;
    warehouse_id: number | null;
    driver: { id: number; name: string } | null;
    round_id: number | null;
    scheduled_date: string | null;
    notes: string | null;
    items: NoteLine[];
};

type Option = { id: number; name: string };
type Product = Option & { sku: string | null; sale_price: number };

/** `null` for the note means create; an object means edit. */
export function DeliveryNoteDialog({
    note,
    nextReference,
    customers,
    warehouses,
    products,
    drivers,
    rounds,
    onClose,
    preservePageState = false,
    customerCreateUrl = null,
    defaultRoundId = null,
}: {
    note: EditableNote | null;
    nextReference: string;
    customers: Option[];
    warehouses: Option[];
    products: Product[];
    drivers: Option[];
    rounds: Array<{ id: number; reference: string | null }>;
    onClose: () => void;
    /** Keeps the calling page mounted on success. Set when this dialog is
     *  opened from another dialog, which a remount would otherwise close. */
    preservePageState?: boolean;
    /** The customer list, where a customer is added. Null when Account is absent. */
    customerCreateUrl?: string | null;
    /** Round to attach to, when opened from the round planner. */
    defaultRoundId?: number | null;
}) {
    const { t } = useTranslation();
    const isEdit = !!note;

    const form = useForm({
        reference: note?.reference ?? '',
        customer_id: note?.customer_id ? String(note.customer_id) : '',
        warehouse_id: note?.warehouse_id ? String(note.warehouse_id) : '',
        driver_id: note?.driver?.id ? String(note.driver.id) : '',
        round_id: note?.round_id ? String(note.round_id) : defaultRoundId ? String(defaultRoundId) : '',
        scheduled_date: note?.scheduled_date ?? new Date().toISOString().slice(0, 10),
        notes: note?.notes ?? '',
        items: (note?.items?.length ? note.items : [{ product_id: null, description: '', quantity: 1, unit_price: 0 }]) as NoteLine[],
    });

    // The note total is derived from the lines, never typed in - the server
    // recomputes it the same way when it saves.
    const total = useMemo(
        () => form.data.items.reduce((sum, line) => sum + (line.quantity || 0) * (line.unit_price || 0), 0),
        [form.data.items]
    );

    const setLine = (index: number, patch: Partial<NoteLine>) => {
        form.setData(
            'items',
            form.data.items.map((line, i) => (i === index ? { ...line, ...patch } : line))
        );
    };

    const addLine = () =>
        form.setData('items', [...form.data.items, { product_id: null, description: '', quantity: 1, unit_price: 0 }]);

    const removeLine = (index: number) =>
        form.setData('items', form.data.items.filter((_, i) => i !== index));

    /** Picking a product fills the price from the catalogue as a starting point. */
    const pickProduct = (index: number, productId: string) => {
        const product = products.find((p) => String(p.id) === productId);

        setLine(index, {
            product_id: product ? product.id : null,
            description: product?.name ?? null,
            unit_price: product ? Number(product.sale_price) : form.data.items[index].unit_price,
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        // Empty selects post as "" which would fail integer validation.
        const transform = (data: any) => ({
            ...data,
            customer_id: data.customer_id || null,
            warehouse_id: data.warehouse_id || null,
            driver_id: data.driver_id || null,
            round_id: data.round_id || null,
        });

        if (isEdit) {
            form.transform(transform).put(route('distribution.delivery-notes.update', note!.id), {
                preserveScroll: true,
                preserveState: preservePageState,
                onSuccess: onClose,
            });
        } else {
            form.transform(transform).post(route('distribution.delivery-notes.store'), {
                preserveScroll: true,
                preserveState: preservePageState,
                onSuccess: onClose,
            });
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? t('Edit delivery note') : t('New delivery note')}</DialogTitle>
                        <DialogDescription>
                            {t('Stock leaves the warehouse when the delivery is completed')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>{t('Reference')}</Label>
                                {/* Generated by the service, which numbers per company
                                    and per year. Shown, not editable: a hand-typed one
                                    breaks that sequence and has to be unique anyway. */}
                                <p className="flex h-10 items-center rounded-md border border-dashed px-3 font-mono text-sm text-muted-foreground">
                                    {isEdit ? form.data.reference || '-' : nextReference}
                                </p>
                                <InputError message={form.errors.reference} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="scheduled_date">{t('Scheduled')}</Label>
                                <Input
                                    id="scheduled_date"
                                    type="date"
                                    value={form.data.scheduled_date}
                                    onChange={(e) => form.setData('scheduled_date', e.target.value)}
                                />
                                <InputError message={form.errors.scheduled_date} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label>{t('Customer')} *</Label>
                                    {/* Goes to the customer list, where the add dialog
                                        lives. Absent when Account is not installed, so
                                        the link is never rendered against a route that
                                        does not exist. Opens in a new tab: this note is
                                        half-written and must survive. */}
                                    {customerCreateUrl && (
                                        <a
                                            href={customerCreateUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                            + {t('New customer')}
                                        </a>
                                    )}
                                </div>
                                <Select value={form.data.customer_id} onValueChange={(v) => form.setData('customer_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select a customer')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((c) => (
                                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={form.errors.customer_id} />
                            </div>
                            <div className="grid gap-2">
                                <Label>{t('Warehouse')}</Label>
                                <Select value={form.data.warehouse_id} onValueChange={(v) => form.setData('warehouse_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select a warehouse')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map((w) => (
                                            <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={form.errors.warehouse_id} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label>{t('Driver')}</Label>
                                <Select value={form.data.driver_id} onValueChange={(v) => form.setData('driver_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Unassigned')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {drivers.map((d) => (
                                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InputError message={form.errors.driver_id} />
                            </div>
                            <div className="grid gap-2">
                                <Label>{t('Round')}</Label>
                                {/* Opened from the round planner the round is already
                                    decided, and the planner attaches the note either
                                    way - offering the choice here only invites a
                                    contradiction. */}
                                {defaultRoundId ? (
                                    <p className="flex h-10 items-center rounded-md border border-dashed px-3 font-mono text-sm text-muted-foreground">
                                        {rounds.find((r) => r.id === defaultRoundId)?.reference ?? `#${defaultRoundId}`}
                                    </p>
                                ) : (
                                    <Select value={form.data.round_id} onValueChange={(v) => form.setData('round_id', v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('No round')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rounds.map((r) => (
                                                <SelectItem key={r.id} value={String(r.id)}>
                                                    {r.reference ?? `#${r.id}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                                <InputError message={form.errors.round_id} />
                            </div>
                        </div>

                        <div className="space-y-2 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">{t('Items')}</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                                    <Plus className="me-2 h-4 w-4" />
                                    {t('Add line')}
                                </Button>
                            </div>

                            {form.data.items.map((line, index) => (
                                <div key={index} className="grid grid-cols-12 items-end gap-2">
                                    <div className="col-span-12 sm:col-span-5">
                                        <Select
                                            value={line.product_id ? String(line.product_id) : ''}
                                            onValueChange={(v) => pickProduct(index, v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('Select a product')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map((p) => (
                                                    <SelectItem key={p.id} value={String(p.id)}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-4 sm:col-span-2">
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={line.quantity}
                                            onChange={(e) => setLine(index, { quantity: Number(e.target.value) })}
                                            aria-label={t('Quantity')}
                                        />
                                    </div>
                                    <div className="col-span-5 sm:col-span-3">
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={line.unit_price}
                                            onChange={(e) => setLine(index, { unit_price: Number(e.target.value) })}
                                            aria-label={t('Unit price')}
                                        />
                                    </div>
                                    <div className="col-span-3 sm:col-span-2 flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={form.data.items.length === 1}
                                            onClick={() => removeLine(index)}
                                            aria-label={t('Remove line')}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <InputError message={(form.errors as Record<string, string>).items} />

                            <div className="flex items-center justify-between border-t pt-3 text-sm">
                                <span className="text-muted-foreground">{t('Total')}</span>
                                <span className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</span>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="note-notes">{t('Notes')}</Label>
                            <Textarea
                                id="note-notes"
                                value={form.data.notes}
                                onChange={(e) => form.setData('notes', e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing || !form.data.customer_id}>
                            {isEdit ? t('Save') : t('Create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
