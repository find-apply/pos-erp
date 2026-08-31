import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, TriangleAlert, X } from 'lucide-react';
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

type Option = { id: number; name: string };
type Vehicle = Option & { plate_number: string | null };
/** A driver plus the vehicle assigned to them in fleet tracking. */
export type Driver = Option & { vehicle_id: number | null; vehicle_name: string | null };

export type AssignableNote = {
    id: number;
    reference: string;
    round_id: number | null;
    total_amount: number;
    customer_name: string | null;
    items_count: number;
    items_summary: string;
};

export type EditableRound = {
    id: number;
    reference: string | null;
    round_date: string | null;
    driver: { id: number; name: string } | null;
    notes: string | null;
};

/**
 * Plan a round: who drives it, from where, and the stops in visiting order.
 *
 * The order of `note_ids` is the stop sequence the backend writes, so the list
 * below is deliberately ordered rather than a plain multi-select.
 */
export function RoundDialog({
    round,
    nextReference,
    drivers,
    vehicles,
    warehouses,
    assignableNotes,
    onCreateNote,
    onClose,
}: {
    round: EditableRound | null;
    nextReference: string;
    drivers: Driver[];
    vehicles: Vehicle[];
    warehouses: Option[];
    assignableNotes: AssignableNote[];
    onCreateNote: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const isEdit = !!round;

    // Stops already on this round come first, in their stored order.
    const [selected, setSelected] = useState<number[]>(
        round ? assignableNotes.filter((n) => n.round_id === round.id).map((n) => n.id) : []
    );

    const form = useForm({
        reference: round?.reference ?? '',
        driver_id: round?.driver?.id ? String(round.driver.id) : '',
        vehicle_id: '',
        warehouse_id: '',
        round_date: round?.round_date ?? new Date().toISOString().slice(0, 10),
        notes: round?.notes ?? '',
        note_ids: [] as number[],
    });

    /**
     * Note ids that existed when this dialog opened.
     *
     * Anything appearing after is a note just created from inside the planner,
     * and is appended to the round automatically - otherwise it would land
     * silently in the pool and have to be picked out by hand.
     */
    const knownNoteIds = useRef(new Set(assignableNotes.map((note) => note.id)));

    useEffect(() => {
        const fresh = assignableNotes
            .filter((note) => !knownNoteIds.current.has(note.id))
            .map((note) => note.id);

        if (fresh.length === 0) return;

        fresh.forEach((id) => knownNoteIds.current.add(id));
        setSelected((current) => [...current, ...fresh.filter((id) => !current.includes(id))]);
    }, [assignableNotes]);

    const selectedDriver = useMemo(
        () => drivers.find((d) => String(d.id) === form.data.driver_id) ?? null,
        [drivers, form.data.driver_id]
    );

    /**
     * Picking a driver fills in their vehicle.
     *
     * The pairing already exists in fleet tracking, so asking for it again here
     * is a second chance to get it wrong. A driver with no assignment clears the
     * field rather than leaving the previous driver's van behind.
     */
    const chooseDriver = (value: string) => {
        const driver = drivers.find((d) => String(d.id) === value);

        form.setData((current) => ({
            ...current,
            driver_id: value,
            vehicle_id: driver?.vehicle_id ? String(driver.vehicle_id) : '',
        }));
    };

    const byId = useMemo(
        () => Object.fromEntries(assignableNotes.map((note) => [note.id, note])),
        [assignableNotes]
    );

    // Free notes, plus whatever is already on this round.
    const available = useMemo(
        () => assignableNotes.filter((note) => !selected.includes(note.id) && (note.round_id === null || note.round_id === round?.id)),
        [assignableNotes, round?.id, selected]
    );

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= selected.length) return;

        const next = [...selected];
        [next[index], next[target]] = [next[target], next[index]];
        setSelected(next);
    };

    const total = useMemo(
        () => selected.reduce((sum, id) => sum + (byId[id]?.total_amount ?? 0), 0),
        [byId, selected]
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const transform = (data: any) => ({
            ...data,
            driver_id: data.driver_id || null,
            vehicle_id: data.vehicle_id || null,
            warehouse_id: data.warehouse_id || null,
            // Order carries the meaning here.
            note_ids: selected,
        });

        if (isEdit) {
            form.transform(transform).put(route('distribution.rounds.update', round!.id), {
                preserveScroll: true,
                onSuccess: onClose,
            });
        } else {
            form.transform(transform).post(route('distribution.rounds.store'), {
                preserveScroll: true,
                onSuccess: onClose,
            });
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? t('Edit round') : t('New round')}</DialogTitle>
                        <DialogDescription>{t('The order of the stops is the visiting order')}</DialogDescription>
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
                                <Label htmlFor="round-date">
                                    {t('Date')} <span className="text-red-600">*</span>
                                </Label>
                                <Input
                                    id="round-date"
                                    type="date"
                                    required
                                    value={form.data.round_date}
                                    onChange={(e) => form.setData('round_date', e.target.value)}
                                />
                                <InputError message={form.errors.round_date} />
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label>
                                    {t('Driver')} <span className="text-red-600">*</span>
                                </Label>
                                <Select value={form.data.driver_id} onValueChange={chooseDriver}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('Select a driver')} />
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
                                <Label>{t('Vehicle')}</Label>
                                <Select value={form.data.vehicle_id} onValueChange={(v) => form.setData('vehicle_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="-" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicles.map((v) => (
                                            <SelectItem key={v.id} value={String(v.id)}>
                                                {v.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {/* The pairing is configured in fleet tracking; without
                                    it there is nothing to fill in, and the round would go
                                    out with no vehicle behind it. */}
                                {selectedDriver && !selectedDriver.vehicle_id && (
                                    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            {t('This driver has no vehicle assigned.')}{' '}
                                            <a
                                                href={route('fleet-tracking.vehicles.index')}
                                                className="underline"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {t('Assign one')}
                                            </a>
                                        </span>
                                    </p>
                                )}
                                <InputError message={form.errors.vehicle_id} />
                            </div>
                            <div className="grid gap-2">
                                <Label>{t('Warehouse')}</Label>
                                <Select value={form.data.warehouse_id} onValueChange={(v) => form.setData('warehouse_id', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="-" />
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

                        <div className="space-y-2 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">
                                    {t('Stops')} ({selected.length})
                                </Label>
                                {selected.length > 0 && (
                                    <span className="text-sm text-muted-foreground">{formatCurrency(total)}</span>
                                )}
                            </div>

                            {selected.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-4 text-center">
                                    <p className="text-sm text-muted-foreground">{t('No stop yet')}</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-3"
                                        onClick={onCreateNote}
                                    >
                                        <Plus className="me-2 h-4 w-4" />
                                        {t('New delivery note')}
                                    </Button>
                                </div>
                            ) : (
                                <ol className="space-y-2">
                                    {selected.map((id, index) => (
                                        <li
                                            key={id}
                                            className="flex items-center gap-2 rounded-lg border p-2"
                                        >
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                                {index + 1}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                {/* Customer leads: when sequencing stops you
                                                    are thinking in customers, not references. */}
                                                <span className="block truncate text-sm font-medium">
                                                    {byId[id]?.customer_name ?? t('Unknown customer')}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {byId[id]?.reference ?? `#${id}`}
                                                    {byId[id]?.items_count
                                                        ? ` · ${byId[id]?.items_summary}${
                                                              (byId[id]?.items_count ?? 0) > 3 ? '…' : ''
                                                          }`
                                                        : ` · ${t('No line')}`}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                                {formatCurrency(byId[id]?.total_amount ?? 0)}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={index === 0}
                                                onClick={() => move(index, -1)}
                                                aria-label={t('Move up')}
                                            >
                                                <ArrowUp className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={index === selected.length - 1}
                                                onClick={() => move(index, 1)}
                                                aria-label={t('Move down')}
                                            >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => setSelected(selected.filter((s) => s !== id))}
                                                aria-label={t('Remove')}
                                            >
                                                <X className="h-3.5 w-3.5 text-red-600" />
                                            </Button>
                                        </li>
                                    ))}
                                </ol>
                            )}

                            {selected.length > 0 && (
                                <Button type="button" variant="outline" size="sm" onClick={onCreateNote}>
                                    <Plus className="me-2 h-4 w-4" />
                                    {t('New delivery note')}
                                </Button>
                            )}

                            {available.length > 0 && (
                                <div className="mt-2">
                                    <Label className="text-sm text-muted-foreground">{t('Available delivery notes')}</Label>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {available.map((note) => (
                                            <Button
                                                key={note.id}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-auto flex-col items-start gap-0.5 py-1.5"
                                                onClick={() => setSelected([...selected, note.id])}
                                            >
                                                <span className="text-xs font-medium">
                                                    + {note.customer_name ?? note.reference}
                                                </span>
                                                <span className="text-[11px] font-normal text-muted-foreground">
                                                    {note.items_count} {t('lines')} · {formatCurrency(note.total_amount)}
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="round-notes">{t('Notes')}</Label>
                            <Textarea
                                id="round-notes"
                                value={form.data.notes}
                                onChange={(e) => form.setData('notes', e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {isEdit ? t('Save') : t('Create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
