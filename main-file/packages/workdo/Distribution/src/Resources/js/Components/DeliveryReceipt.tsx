import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDateTime } from '@/utils/helpers';

/**
 * Paper widths, and how much of each is usable once margins are taken off.
 *
 * `content` is what the receipt is laid out in; a thermal roll has almost no
 * margin to spare, so it gets a smaller one than a sheet.
 */
const PAPER: Record<string, { page: string; content: string; margin: string; font: string }> = {
    '52mm': { page: '52mm', content: '46mm', margin: '3mm', font: '10px' },
    '58mm': { page: '58mm', content: '52mm', margin: '3mm', font: '11px' },
    '80mm': { page: '80mm', content: '72mm', margin: '4mm', font: '12px' },
    a5: { page: 'A5', content: '128mm', margin: '10mm', font: '12px' },
    a4: { page: 'A4', content: '190mm', margin: '10mm', font: '12px' },
};

const STORAGE_KEY = 'distribution.printer.format';

export type ReceiptNote = {
    id: number;
    reference: string | null;
    status: string;
    total_amount: number;
    collected_amount: number;
    recipient_name: string | null;
    customer_name: string | null;
    items: Array<{ description: string | null; quantity: number; unit_price: number }>;
};

/** Reads the size the driver chose on the printer screen. */
export function readPaperFormat(): string {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored && PAPER[stored] ? stored : '58mm';
    } catch {
        return '58mm';
    }
}

/**
 * A printable delivery receipt.
 *
 * Rendered into `document.body` so that, when printing, every *sibling* can be
 * removed from the layout with `display: none`. Hiding the app with
 * `visibility: hidden` instead leaves it occupying its full height, which both
 * forces the sheet to stay A4 and emits a blank second page.
 */
export function DeliveryReceipt({
    note,
    company,
    driverName,
    format,
}: {
    note: ReceiptNote;
    company: string;
    driverName: string;
    format: string;
}) {
    const { t } = useTranslation();
    const paper = PAPER[format] ?? PAPER['58mm'];
    const outstanding = note.total_amount - note.collected_amount;

    useEffect(() => {
        const style = document.createElement('style');
        style.setAttribute('data-receipt-print', 'true');
        style.textContent = `
            @media print {
                @page { size: ${paper.page} auto; margin: ${paper.margin}; }

                /* Collapse the page to the paper, or the roll width is ignored. */
                html, body {
                    width: ${paper.content} !important;
                    min-height: 0 !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                    overflow: visible !important;
                }

                /* display:none, not visibility:hidden - the app must leave the
                   flow entirely so it cannot push a second blank page. */
                body > *:not(#delivery-receipt) { display: none !important; }

                #delivery-receipt {
                    display: block !important;
                    position: static !important;
                    width: ${paper.content} !important;
                    max-width: ${paper.content} !important;
                    font-size: ${paper.font};
                    color: #000;
                    background: #fff;
                }

                #delivery-receipt table { width: 100%; table-layout: fixed; }
            }
        `;
        document.head.appendChild(style);

        return () => {
            style.remove();
        };
    }, [paper.content, paper.font, paper.margin, paper.page]);

    if (typeof document === 'undefined') {
        return null;
    }

    const rule = { borderTop: '1px dashed #000', margin: '4px 0' };
    // Amounts must never wrap or be squeezed out; the description takes the rest.
    const amountCell = { textAlign: 'end' as const, whiteSpace: 'nowrap' as const, width: '40%' };

    return createPortal(
        <div
            id="delivery-receipt"
            // Off-screen on screen; the print stylesheet is what reveals it.
            style={{ position: 'fixed', insetInlineStart: '-9999px', top: 0, pointerEvents: 'none' }}
            aria-hidden="true"
        >
            <div style={{ fontFamily: 'monospace', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.15em' }}>{company}</div>
                <div style={{ textAlign: 'center', marginBottom: 6 }}>{t('Delivery note')}</div>

                <div style={rule} />

                <div>{note.reference ?? `#${note.id}`}</div>
                <div>{formatDateTime(new Date().toISOString())}</div>
                {note.customer_name && <div>{t('Customer')}: {note.customer_name}</div>}
                <div>{t('Driver')}: {driverName}</div>

                <div style={rule} />

                {note.items.length > 0 ? (
                    <table style={{ borderCollapse: 'collapse' }}>
                        <tbody>
                            {note.items.map((item, index) => (
                                <tr key={index}>
                                    <td style={{ verticalAlign: 'top' }}>
                                        {item.description ?? '-'}
                                        <div style={{ opacity: 0.8 }}>
                                            {item.quantity} × {formatCurrency(item.unit_price)}
                                        </div>
                                    </td>
                                    <td style={{ ...amountCell, verticalAlign: 'top' }}>
                                        {formatCurrency(item.quantity * item.unit_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div style={{ opacity: 0.8 }}>{t('No line on this delivery note')}</div>
                )}

                <div style={rule} />

                <table style={{ borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td>{t('Total')}</td>
                            <td style={{ ...amountCell, fontWeight: 700 }}>{formatCurrency(note.total_amount)}</td>
                        </tr>
                        <tr>
                            <td>{t('Collected')}</td>
                            <td style={amountCell}>{formatCurrency(note.collected_amount)}</td>
                        </tr>
                        {outstanding > 0 && (
                            <tr>
                                <td>{t('Outstanding')}</td>
                                <td style={{ ...amountCell, fontWeight: 700 }}>{formatCurrency(outstanding)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <div style={{ ...rule, marginTop: 6 }} />

                <div>{t('Received by')}: {note.recipient_name ?? '_________________'}</div>
                <div style={{ height: 28 }} />
                <div style={{ textAlign: 'center', opacity: 0.8 }}>{t('Thank you')}</div>
            </div>
        </div>,
        document.body
    );
}
