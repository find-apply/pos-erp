type Tone = 'blue' | 'orange' | 'green' | 'red' | 'gray';

/**
 * Status vocabulary shared by every distribution screen, so a note or a round
 * reads the same colour and wording wherever it appears.
 */
export const NOTE_TONES: Record<string, Tone> = {
    pending: 'gray',
    assigned: 'blue',
    in_transit: 'blue',
    delivered: 'green',
    partial: 'orange',
    failed: 'red',
    returned: 'orange',
};

export const ROUND_TONES: Record<string, Tone> = {
    planned: 'gray',
    in_progress: 'blue',
    completed: 'green',
    cancelled: 'red',
};

export const NOTE_STATUSES = [
    'pending',
    'assigned',
    'in_transit',
    'delivered',
    'partial',
    'failed',
    'returned',
] as const;

export const ROUND_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const;

/**
 * Labels go through `t()` with explicit literal keys rather than an
 * interpolated one, so the translation extractor can still find them.
 */
export function noteStatusLabel(status: string, t: (key: string) => string): string {
    const labels: Record<string, string> = {
        pending: t('Pending'),
        assigned: t('Assigned'),
        in_transit: t('In Transit'),
        delivered: t('Delivered'),
        partial: t('Partial'),
        failed: t('Failed'),
        returned: t('Returned'),
    };

    return labels[status] ?? status;
}

export function roundStatusLabel(status: string, t: (key: string) => string): string {
    const labels: Record<string, string> = {
        planned: t('Planned'),
        in_progress: t('In Progress'),
        completed: t('Completed'),
        cancelled: t('Cancelled'),
    };

    return labels[status] ?? status;
}
