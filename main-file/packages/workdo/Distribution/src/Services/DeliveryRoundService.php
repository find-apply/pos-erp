<?php

namespace Workdo\Distribution\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Workdo\Distribution\Models\DeliveryNote;
use Workdo\Distribution\Models\DeliveryRound;

/**
 * Planning and running a round: which notes are on it, in what order, and
 * where it is up to.
 */
class DeliveryRoundService
{
    public function create(array $data, int $companyId, int $creatorId): DeliveryRound
    {
        return DB::transaction(function () use ($data, $companyId, $creatorId) {
            $round = DeliveryRound::create([
                'reference' => ($data['reference'] ?? null) ?: $this->nextReference($companyId),
                'driver_id' => $data['driver_id'] ?? null,
                'vehicle_id' => $data['vehicle_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'] ?? null,
                'round_date' => $data['round_date'] ?? today(),
                'status' => DeliveryRound::STATUS_PLANNED,
                'notes' => $data['notes'] ?? null,
                'creator_id' => $creatorId,
                'created_by' => $companyId,
            ]);

            $this->syncStops($round, $data['note_ids'] ?? []);

            return $round->refresh();
        });
    }

    public function update(DeliveryRound $round, array $data): DeliveryRound
    {
        return DB::transaction(function () use ($round, $data) {
            $round->update([
                'driver_id' => $data['driver_id'] ?? null,
                'vehicle_id' => $data['vehicle_id'] ?? null,
                'warehouse_id' => $data['warehouse_id'] ?? null,
                'round_date' => $data['round_date'] ?? $round->round_date,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncStops($round, $data['note_ids'] ?? []);

            return $round->refresh();
        });
    }

    /** Starting a round is what the delivery-time metric measures from. */
    public function start(DeliveryRound $round): DeliveryRound
    {
        if ($round->status === DeliveryRound::STATUS_PLANNED) {
            $round->update([
                'status' => DeliveryRound::STATUS_IN_PROGRESS,
                'started_at' => now(),
            ]);
        }

        return $round->refresh();
    }

    public function complete(DeliveryRound $round): DeliveryRound
    {
        if ($round->status === DeliveryRound::STATUS_IN_PROGRESS) {
            $round->update([
                'status' => DeliveryRound::STATUS_COMPLETED,
                'completed_at' => now(),
            ]);
        }

        return $round->refresh();
    }

    public function cancel(DeliveryRound $round): DeliveryRound
    {
        $round->update(['status' => DeliveryRound::STATUS_CANCELLED]);

        // Stops go back to the unassigned pool rather than being stranded on a
        // cancelled round.
        DeliveryNote::where('round_id', $round->id)
            ->whereIn('status', DeliveryNote::OPEN_STATUSES)
            ->update(['round_id' => null, 'sequence' => 0]);

        return $round->refresh();
    }

    public function delete(DeliveryRound $round): void
    {
        DB::transaction(function () use ($round) {
            DeliveryNote::where('round_id', $round->id)
                ->update(['round_id' => null, 'sequence' => 0]);

            $round->delete();
        });
    }

    /**
     * Set the round's stops, in the given order.
     *
     * The incoming order is the stop sequence, and the round's driver is
     * pushed onto every note so the driver's own screen shows them.
     *
     * @param array<int, int> $noteIds Delivery note ids, in visiting order.
     */
    private function syncStops(DeliveryRound $round, array $noteIds): void
    {
        // Notes dropped from the round are released, not deleted.
        DeliveryNote::where('round_id', $round->id)
            ->whereNotIn('id', $noteIds ?: [0])
            ->update(['round_id' => null, 'sequence' => 0]);

        foreach (array_values($noteIds) as $index => $noteId) {
            $note = DeliveryNote::where('created_by', $round->created_by)->find($noteId);

            if (!$note) {
                continue;
            }

            $note->update([
                'round_id' => $round->id,
                'sequence' => $index + 1,
                'driver_id' => $round->driver_id ?? $note->driver_id,
                'status' => in_array($note->status, DeliveryNote::OPEN_STATUSES, true) && $round->driver_id
                    ? DeliveryNote::STATUS_ASSIGNED
                    : $note->status,
            ]);
        }
    }

    /** Sequential per-company reference, e.g. TRN-2026-001. */
    public function nextReference(int $companyId): string
    {
        $prefix = 'TRN-'.now()->year.'-';

        $last = DeliveryRound::where('created_by', $companyId)
            ->where('reference', 'like', $prefix.'%')
            ->orderByDesc('id')
            ->value('reference');

        $next = $last ? ((int) Str::afterLast($last, '-')) + 1 : 1;

        return $prefix.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }
}
