import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { FileText, MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { EmptyState, ScrollX, SectionCard, StatusBadge } from '@/components/ui/page-kit';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { DeliveryNoteDialog, EditableNote } from '../Components/DeliveryNoteDialog';
import { NOTE_STATUSES, NOTE_TONES, noteStatusLabel } from '../lib/status';

declare global {
    function route(name: string, params?: any): string;
}

type Note = EditableNote & {
    status: string;
    delivered_at: string | null;
    total_amount: number;
    collected_amount: number;
    // Sent by the controller for the table; the dialog works off `round_id`.
    round: { id: number; reference: string | null } | null;
};

type Option = { id: number; name: string };

type Props = {
    notes: Note[];
    filters: { status: string | null };
    customer_create_url: string | null;
    customers: Option[];
    warehouses: Option[];
    products: Array<Option & { sku: string | null; sale_price: number }>;
    drivers: Option[];
    rounds: Array<{ id: number; reference: string | null }>;
    next_reference: string;
};

export default function DeliveryNotes() {
    const { t } = useTranslation();
    const {
        notes,
        filters,
        customer_create_url: customerCreateUrl,
        customers,
        warehouses,
        products,
        drivers,
        rounds,
        next_reference: nextReference,
    } = usePage<Props>().props;

    const [search, setSearch] = useState('');
    // `undefined` closed, `null` create, an object edit.
    const [dialogFor, setDialogFor] = useState<Note | null | undefined>(undefined);
    const [deleting, setDeleting] = useState<Note | null>(null);

    const onStatusChange = (status: string) => {
        router.get(
            route('distribution.delivery-notes'),
            status ? { status } : {},
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return notes;

        return notes.filter(
            (note) =>
                (note.reference ?? '').toLowerCase().includes(term)
                || (note.driver?.name ?? '').toLowerCase().includes(term)
        );
    }, [notes, search]);

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Distribution'), url: route('distribution.index') }, { label: t('Delivery Notes') }]}
            pageTitle={t('Delivery Notes')}
            pageActions={(
                <Button onClick={() => setDialogFor(null)}>
                    <Plus className="me-2 h-4 w-4" />
                    {t('New delivery note')}
                </Button>
            )}
        >
            <Head title={t('Delivery Notes')} />

            <div className="mx-auto max-w-7xl space-y-5">
                <p className="text-sm text-muted-foreground">{t('Track delivery notes and their collection')}</p>

                <SectionCard flush>
                    <div className="flex flex-col gap-2 p-4 sm:flex-row">
                        <div className="relative sm:w-80">
                            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="ps-9"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t('Search...')}
                            />
                        </div>
                        <select
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            value={filters.status ?? ''}
                            onChange={(event) => onStatusChange(event.target.value)}
                        >
                            <option value="">{t('All statuses')}</option>
                            {NOTE_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {noteStatusLabel(status, t)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="border-t border-gray-100 dark:border-slate-800">
                            <EmptyState
                                icon={<FileText className="h-8 w-8" />}
                                title={t('No delivery note')}
                                description={t('Delivery notes appear here once distribution starts')}
                            />
                        </div>
                    ) : (
                        <ScrollX className="border-t border-gray-100 dark:border-slate-800">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr className="border-b">
                                        <th className="p-3 text-start font-medium">{t('Reference')}</th>
                                        <th className="p-3 text-start font-medium">{t('Scheduled')}</th>
                                        <th className="p-3 text-start font-medium">{t('Driver')}</th>
                                        <th className="p-3 text-start font-medium">{t('Round')}</th>
                                        <th className="p-3 text-start font-medium">{t('Amount')}</th>
                                        <th className="p-3 text-start font-medium">{t('Collected')}</th>
                                        <th className="p-3 text-start font-medium">{t('Status')}</th>
                                        <th className="p-3 text-end font-medium">{t('Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((note) => (
                                        <tr key={note.id} className="border-b last:border-0">
                                            <td className="p-3 font-medium">{note.reference ?? `#${note.id}`}</td>
                                            <td className="p-3">{note.scheduled_date ? formatDate(note.scheduled_date) : '-'}</td>
                                            <td className="p-3">{note.driver?.name ?? <span className="text-muted-foreground">{t('Unassigned')}</span>}</td>
                                            <td className="p-3">{note.round?.reference ?? (note.round ? `#${note.round.id}` : '-')}</td>
                                            <td className="p-3 tabular-nums">{formatCurrency(note.total_amount)}</td>
                                            <td className="p-3 tabular-nums">{formatCurrency(note.collected_amount)}</td>
                                            <td className="p-3">
                                                <StatusBadge tone={NOTE_TONES[note.status] ?? 'gray'}>
                                                    {noteStatusLabel(note.status, t)}
                                                </StatusBadge>
                                            </td>
                                            <td className="p-3 text-end">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => setDialogFor(note)}>
                                                            <Pencil className="me-2 h-4 w-4" />
                                                            {t('Edit')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-600 focus:text-red-600"
                                                            onClick={() => setDeleting(note)}
                                                        >
                                                            <Trash2 className="me-2 h-4 w-4" />
                                                            {t('Delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ScrollX>
                    )}
                </SectionCard>
            </div>

            {dialogFor !== undefined && (
                <DeliveryNoteDialog
                    note={dialogFor}
                    nextReference={nextReference}
                    customers={customers}
                    warehouses={warehouses}
                    products={products}
                    drivers={drivers}
                    rounds={rounds}
                    customerCreateUrl={customerCreateUrl}
                    onClose={() => setDialogFor(undefined)}
                />
            )}

            {deleting && (
                <ConfirmationDialog
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={t('Delete delivery note')}
                    message={t('Any stock already issued for this note is returned to the warehouse.')}
                    variant="destructive"
                    onConfirm={() =>
                        router.delete(route('distribution.delivery-notes.destroy', deleting.id), {
                            preserveScroll: true,
                            onFinish: () => setDeleting(null),
                        })
                    }
                />
            )}
        </AuthenticatedLayout>
    );
}
