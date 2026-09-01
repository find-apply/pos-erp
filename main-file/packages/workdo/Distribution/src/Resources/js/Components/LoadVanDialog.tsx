import { FormEvent, useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputError } from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

declare global {
    function route(name: string, params?: any): string;
}

type Option = { id: number; name: string };
type Product = Option & { sku: string | null };
type Line = { product_id: number | null; quantity: number };

/**
 * Move stock between a warehouse and a driver's van.
 *
 * @param mode "load" takes stock out of the warehouse and onto the van;
 *             "unload" returns it.
 */
export function LoadVanDialog({
    driver,
    mode,
    warehouses,
    products,
    onClose,
}: {
    driver: { id: number; name: string };
    mode: 'load' | 'unload';
    warehouses: Option[];
    products: Product[];
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const [lines, setLines] = useState<Line[]>([{ product_id: null, quantity: 1 }]);

    const form = useForm({
        warehouse_id: warehouses.length === 1 ? String(warehouses[0].id) : '',
        items: [] as Line[],
    });

    const ready = useMemo(
        () => !!form.data.warehouse_id && lines.some((line) => line.product_id && line.quantity > 0),
        [form.data.warehouse_id, lines]
    );

    const setLine = (index: number, patch: Partial<Line>) =>
        setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

    const submit = (event: FormEvent) => {
        event.preventDefault();

        // transform() stores the callback and returns nothing, so it cannot be
        // chained - the request has to be its own statement.
        form.transform((data) => ({
            ...data,
            // Blank rows are a UI convenience, not something to post.
            items: lines.filter((line) => line.product_id && line.quantity > 0),
        }));

        form.post(
            route(mode === 'load' ? 'distribution.drivers.load' : 'distribution.drivers.unload', driver.id),
            { preserveScroll: true, onSuccess: onClose }
        );
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <form onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle>
                            {mode === 'load' ? t('Load vehicle') : t('Unload vehicle')} — {driver.name}
                        </DialogTitle>
                        <DialogDescription>
                            {mode === 'load'
                                ? t('Stock moves from the warehouse onto the vehicle')
                                : t('Stock returns from the vehicle to the warehouse')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>{t('Warehouse')} *</Label>
                            <Select
                                value={form.data.warehouse_id}
                                onValueChange={(v) => form.setData('warehouse_id', v)}
                            >
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

                        <div className="space-y-2 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">{t('Items')}</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setLines([...lines, { product_id: null, quantity: 1 }])}
                                >
                                    <Plus className="me-2 h-4 w-4" />
                                    {t('Add line')}
                                </Button>
                            </div>

                            {lines.map((line, index) => (
                                <div key={index} className="grid grid-cols-12 items-center gap-2">
                                    <div className="col-span-7">
                                        <Select
                                            value={line.product_id ? String(line.product_id) : ''}
                                            onValueChange={(v) => setLine(index, { product_id: Number(v) })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('Select a product')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map((p) => (
                                                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-3">
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={line.quantity}
                                            onChange={(e) => setLine(index, { quantity: Number(e.target.value) })}
                                            aria-label={t('Quantity')}
                                        />
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={lines.length === 1}
                                            onClick={() => setLines(lines.filter((_, i) => i !== index))}
                                            aria-label={t('Remove line')}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <InputError message={(form.errors as Record<string, string>).items} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing || !ready}>
                            {mode === 'load' ? t('Load') : t('Unload')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
