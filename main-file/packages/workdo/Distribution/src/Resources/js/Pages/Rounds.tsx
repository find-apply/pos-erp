import { useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Map, MoreVertical, Pencil, Play, Plus, Route as RouteIcon, Search, Trash2, XCircle } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/authenticated-layout';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { EmptyState, ScrollX, SectionCard, StatusBadge } from '@/components/ui/page-kit';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { DeliveryNoteDialog } from '../Components/DeliveryNoteDialog';
import { AssignableNote, Driver, EditableRound, RoundDialog } from '../Components/RoundDialog';
import { RoundMapDialog } from '../Components/RoundMapDialog';
import { ROUND_STATUSES, ROUND_TONES, roundStatusLabel } from '../lib/status';

declare global {
    function route(name: string, params?: any): string;
}

type Round = {
    id: number;
    reference: string | null;
    status: string;
    round_date: string | null;
    driver: { id: number; name: string } | null;
    stops_total: number;
    stops_done: number;
    collected: number;
};

type Option = { id: number; name: string };

type Props = {
    rounds: Round[];
    filters: { status: string | null };
    // Carries the vehicle assigned in fleet tracking, which the round dialog
    // fills in when a driver is picked.
    drivers: Driver[];
    vehicles: Array<Option & { plate_number: string | null }>;
    warehouses: Option[];
    assignable_notes: AssignableNote[];
    next_reference: string;
    next_note_reference: string;
    customer_create_url: string | null;
    customers: Option[];
    products: Array<{ id: number; name: string; sku: string | null; sale_price: number }>;
};

export default function Rounds() {
    const { t } = useTranslation();
    const {
        rounds,
        filters,
        drivers,
        vehicles,
        warehouses,
        assignable_notes: assignableNotes,
        next_reference: nextReference,
        next_note_reference: nextNoteReference,
        customer_create_url: customerCreateUrl,
        customers,
        products,
    } = usePage<Props>().props;

    const [search, setSearch] = useState('');
    const [dialogFor, setDialogFor] = useState<EditableRound | null | undefined>(undefined);
    const [tracking, setTracking] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<Round | null>(null);
    // Opened from inside the round dialog, which stays mounted underneath.
    const [creatingNote, setCreatingNote] = useState(false);

    const transition = (round: Round, action: 'start' | 'complete' | 'cancel') =>
        router.put(route('distribution.rounds.transition', round.id), { action }, { preserveScroll: true });

    // Status filtering is a server round-trip so the list stays authoritative;
    // the free-text search is local because it only narrows what is on screen.
    const onStatusChange = (status: string) => {
        router.get(
            route('distribution.rounds'),
            status ? { status } : {},
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return rounds;

        return rounds.filter(
            (round) =>
                (round.reference ?? '').toLowerCase().includes(term)
                || (round.driver?.name ?? '').toLowerCase().includes(term)
        );
    }, [rounds, search]);

    return (
        <AuthenticatedLayout
            breadcrumbs={[{ label: t('Distribution'), url: route('distribution.index') }, { label: t('Rounds') }]}
            pageTitle={t('Rounds')}
            pageActions={(
                <Button onClick={() => setDialogFor(null)}>
                    <Plus className="me-2 h-4 w-4" />
                    {t('New round')}
                </Button>
            )}
        >
            <Head title={t('Rounds')} />

            <div className="mx-auto max-w-7xl space-y-5">
                <p className="text-sm text-muted-foreground">{t('Plan and manage your delivery rounds')}</p>

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
                            {ROUND_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {roundStatusLabel(status, t)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="border-t border-gray-100 dark:border-slate-800">
                            <EmptyState
                                icon={<RouteIcon className="h-8 w-8" />}
                                title={t('No round')}
                                description={t('Create your first delivery round')}
                            />
                        </div>
                    ) : (
                        <ScrollX className="border-t border-gray-100 dark:border-slate-800">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr className="border-b">
                                        <th className="p-3 text-start font-medium">{t('Reference')}</th>
                                        <th className="p-3 text-start font-medium">{t('Date')}</th>
                                        <th className="p-3 text-start font-medium">{t('Driver')}</th>
                                        <th className="p-3 text-start font-medium">{t('Stops')}</th>
                                        <th className="p-3 text-start font-medium">{t('Collected')}</th>
                                        <th className="p-3 text-start font-medium">{t('Status')}</th>
                                        <th className="p-3 text-end font-medium">{t('Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((round) => (
                                        <tr key={round.id} className="border-b last:border-0">
                                            <td className="p-3 font-medium">{round.reference ?? `#${round.id}`}</td>
                                            <td className="p-3">{round.round_date ? formatDate(round.round_date) : '-'}</td>
                                            <td className="p-3">{round.driver?.name ?? <span className="text-muted-foreground">{t('Unassigned')}</span>}</td>
                                            <td className="p-3 tabular-nums">{round.stops_done}/{round.stops_total}</td>
                                            <td className="p-3 tabular-nums">{formatCurrency(round.collected)}</td>
                                            <td className="p-3">
                                                <StatusBadge tone={ROUND_TONES[round.status] ?? 'gray'}>
                                                    {roundStatusLabel(round.status, t)}
                                                </StatusBadge>
                                            </td>
                                            <td className="p-3 text-end">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setTracking(round.id)}
                                                    aria-label={t('Track the round')}
                                                    title={t('Track the round')}
                                                >
                                                    <Map className="h-4 w-4" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {/* Only the transition the round is actually ready for. */}
                                                        {round.status === 'planned' && (
                                                            <DropdownMenuItem onClick={() => transition(round, 'start')}>
                                                                <Play className="me-2 h-4 w-4" />
                                                                {t('Start')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {round.status === 'in_progress' && (
                                                            <DropdownMenuItem onClick={() => transition(round, 'complete')}>
                                                                <CheckCircle2 className="me-2 h-4 w-4" />
                                                                {t('Complete')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {round.status !== 'cancelled' && round.status !== 'completed' && (
                                                            <DropdownMenuItem onClick={() => transition(round, 'cancel')}>
                                                                <XCircle className="me-2 h-4 w-4" />
                                                                {t('Cancel round')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                setDialogFor({
                                                                    id: round.id,
                                                                    reference: round.reference,
                                                                    round_date: round.round_date,
                                                                    driver: round.driver,
                                                                    notes: null,
                                                                })
                                                            }
                                                        >
                                                            <Pencil className="me-2 h-4 w-4" />
                                                            {t('Edit')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-600 focus:text-red-600"
                                                            onClick={() => setDeleting(round)}
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
                <RoundDialog
                    round={dialogFor}
                    nextReference={nextReference}
                    drivers={drivers}
                    vehicles={vehicles}
                    warehouses={warehouses}
                    assignableNotes={assignableNotes}
                    onCreateNote={() => setCreatingNote(true)}
                    onClose={() => setDialogFor(undefined)}
                />
            )}

            {/* Stacked above the round dialog. The note it creates lands in
                assignable_notes, and the round dialog selects it automatically. */}
            {creatingNote && (
                <DeliveryNoteDialog
                    note={null}
                    nextReference={nextNoteReference}
                    customers={customers}
                    warehouses={warehouses}
                    products={products}
                    drivers={drivers}
                    rounds={rounds.map((r) => ({ id: r.id, reference: r.reference }))}
                    preservePageState
                    customerCreateUrl={customerCreateUrl}
                    // Only when editing: a round being created has no id yet, and
                    // the planner attaches the note once it is saved.
                    defaultRoundId={dialogFor?.id ?? null}
                    onClose={() => setCreatingNote(false)}
                />
            )}

            {tracking !== null && <RoundMapDialog roundId={tracking} onClose={() => setTracking(null)} />}

            {deleting && (
                <ConfirmationDialog
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title={t('Delete round')}
                    message={t('Its stops are released back to the pool, not deleted.')}
                    variant="destructive"
                    onConfirm={() =>
                        router.delete(route('distribution.rounds.destroy', deleting.id), {
                            preserveScroll: true,
                            onFinish: () => setDeleting(null),
                        })
                    }
                />
            )}
        </AuthenticatedLayout>
    );
}
