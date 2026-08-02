import { useEffect, useMemo, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import html2pdf from 'html2pdf.js';
import { formatCurrency, formatDate, getCompanySetting } from '@/utils/helpers';

type Line = {
    id: number;
    line_type: string;
    title: string;
    description?: string;
    explanation?: string;
    quantity?: string | number | null;
    unit_value?: string | number | null;
    amount: string | number;
    direction: string;
    is_included: boolean;
};

type Calculation = {
    id: number;
    calculation_number: string;
    calculation_date: string;
    haul_start_date?: string;
    finalized_at?: string;
    nisab_amount: string | number;
    rate_percent: string | number;
    inventory_valuation_method: string;
    liability_due_within_days: number;
    cash_amount: string | number;
    inventory_amount: string | number;
    receivable_amount: string | number;
    deductible_liabilities_amount: string | number;
    manual_additions_amount: string | number;
    manual_deductions_amount: string | number;
    zakatable_amount: string | number;
    zakat_due: string | number;
    paid_amount: string | number;
    remaining_amount: string | number;
    is_nisab_met: boolean;
    is_haul_met: boolean;
    status: string;
    notes?: string;
    lines: Line[];
    payments: any[];
};

type Guidance = {
    title: string;
    body: string;
};

type Props = {
    calculation: Calculation;
    guidance: Guidance[];
    formula: string;
};

export default function Print() {
    const { t } = useTranslation();
    const { calculation, guidance, formula } = usePage<Props>().props;
    const [isDownloading, setIsDownloading] = useState(false);

    const groupedLines = useMemo(() => {
        return calculation.lines.reduce<Record<string, Line[]>>((groups, line) => {
            groups[line.direction] = groups[line.direction] || [];
            groups[line.direction].push(line);
            return groups;
        }, {});
    }, [calculation.lines]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('download') === 'pdf') {
            downloadPDF();
        }
    }, []);

    const downloadPDF = async () => {
        setIsDownloading(true);
        const content = document.querySelector('.zakat-report-container');

        if (content) {
            const opt = {
                margin: 0.25,
                filename: `zakat-report-${calculation.calculation_number}.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const },
            };

            try {
                await html2pdf().set(opt).from(content as HTMLElement).save();
                setTimeout(() => window.close(), 1000);
            } catch (error) {
                console.error('PDF generation failed:', error);
            }
        }

        setIsDownloading(false);
    };

    const LineTable = ({ title, lines }: { title: string; lines: Line[] }) => (
        <div className="mb-8 page-break-inside-avoid">
            <h2 className="text-lg font-bold mb-3 border-b pb-2">{title}</h2>
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border p-2 text-left">{t('Item')}</th>
                        <th className="border p-2 text-left">{t('Source')}</th>
                        <th className="border p-2 text-right">{t('Quantity')}</th>
                        <th className="border p-2 text-right">{t('Unit Value')}</th>
                        <th className="border p-2 text-right">{t('Amount')}</th>
                        <th className="border p-2 text-left">{t('Explanation')}</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.length > 0 ? lines.map((line) => (
                        <tr key={line.id} className={!line.is_included ? 'bg-gray-50 text-gray-600' : ''}>
                            <td className="border p-2 align-top">
                                <div className="font-semibold">{line.title}</div>
                                <div className="text-gray-500">{line.line_type}</div>
                            </td>
                            <td className="border p-2 align-top">{line.description || '-'}</td>
                            <td className="border p-2 align-top text-right">{line.quantity || '-'}</td>
                            <td className="border p-2 align-top text-right">{line.unit_value ? formatCurrency(line.unit_value) : '-'}</td>
                            <td className="border p-2 align-top text-right font-semibold">{formatCurrency(line.amount)}</td>
                            <td className="border p-2 align-top">
                                {line.explanation}
                                {!line.is_included && <div className="mt-1 font-semibold">{t('Not included in the calculation.')}</div>}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td className="border p-4 text-center text-gray-500" colSpan={6}>{t('No records')}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="min-h-screen bg-white">
            <Head title={`${t('Zakat Report')} - ${calculation.calculation_number}`} />

            {isDownloading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <p className="font-semibold">{t('Generating PDF...')}</p>
                    </div>
                </div>
            )}

            <div className="zakat-report-container bg-white max-w-5xl mx-auto p-10 text-gray-900">
                <div className="flex justify-between items-start mb-10 border-b pb-6">
                    <div>
                        <h1 className="text-2xl font-bold">{getCompanySetting('titleText') || getCompanySetting('company_name') || 'Company'}</h1>
                        <p className="text-sm text-gray-600 mt-1">{t('Zakat Calculation Report')}</p>
                    </div>
                    <div className="text-right text-sm">
                        <p className="font-semibold">{calculation.calculation_number}</p>
                        <p>{t('Calculation Date')}: {formatDate(calculation.calculation_date)}</p>
                        {calculation.finalized_at && <p>{t('Finalized At')}: {formatDate(calculation.finalized_at)}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                    <div className="border rounded p-4">
                        <p><strong>{t('Nisab')}:</strong> {formatCurrency(calculation.nisab_amount)}</p>
                        <p><strong>{t('Zakat Rate')}:</strong> {calculation.rate_percent}%</p>
                        <p><strong>{t('Haul Start Date')}:</strong> {calculation.haul_start_date ? formatDate(calculation.haul_start_date) : '-'}</p>
                        <p><strong>{t('Inventory Valuation')}:</strong> {t(calculation.inventory_valuation_method)}</p>
                    </div>
                    <div className="border rounded p-4">
                        <p><strong>{t('Nisab Status')}:</strong> {calculation.is_nisab_met ? t('Nisab Met') : t('Below Nisab')}</p>
                        <p><strong>{t('Haul Status')}:</strong> {calculation.is_haul_met ? t('Haul Met') : t('Haul Not Met')}</p>
                        <p><strong>{t('Credit Window')}:</strong> {calculation.liability_due_within_days} {t('days')}</p>
                        <p><strong>{t('Status')}:</strong> {t(calculation.status)}</p>
                    </div>
                </div>

                <div className="mb-8 border rounded p-4 bg-gray-50">
                    <h2 className="text-lg font-bold mb-2">{t('Formula')}</h2>
                    <p className="text-sm">{formula}</p>
                    <p className="text-sm mt-2">
                        {t('Capital itself is not counted separately. What remains on zakat day as cash, inventory, or receivables is counted; what was withdrawn before the zakat date is outside the base.')}
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="border rounded p-4">
                        <p className="text-xs text-gray-600">{t('Cash and Bank')}</p>
                        <p className="text-lg font-bold">{formatCurrency(calculation.cash_amount)}</p>
                    </div>
                    <div className="border rounded p-4">
                        <p className="text-xs text-gray-600">{t('Trade Inventory')}</p>
                        <p className="text-lg font-bold">{formatCurrency(calculation.inventory_amount)}</p>
                    </div>
                    <div className="border rounded p-4">
                        <p className="text-xs text-gray-600">{t('Customer Debts')}</p>
                        <p className="text-lg font-bold">{formatCurrency(calculation.receivable_amount)}</p>
                    </div>
                    <div className="border rounded p-4">
                        <p className="text-xs text-gray-600">{t('Manual Additions')}</p>
                        <p className="text-lg font-bold">{formatCurrency(calculation.manual_additions_amount)}</p>
                    </div>
                    <div className="border rounded p-4">
                        <p className="text-xs text-gray-600">{t('Credit Deductions')}</p>
                        <p className="text-lg font-bold">{formatCurrency(calculation.deductible_liabilities_amount)}</p>
                    </div>
                    <div className="border rounded p-4">
                        <p className="text-xs text-gray-600">{t('Manual Deductions')}</p>
                        <p className="text-lg font-bold">{formatCurrency(calculation.manual_deductions_amount)}</p>
                    </div>
                </div>

                <div className="mb-8 border-2 border-gray-900 rounded p-5">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-xs text-gray-600">{t('Zakatable Base')}</p>
                            <p className="text-xl font-bold">{formatCurrency(calculation.zakatable_amount)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">{t('Zakat Due')}</p>
                            <p className="text-xl font-bold">{formatCurrency(calculation.zakat_due)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">{t('Paid')}</p>
                            <p className="text-xl font-bold">{formatCurrency(calculation.paid_amount)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">{t('Remaining')}</p>
                            <p className="text-xl font-bold">{formatCurrency(calculation.remaining_amount)}</p>
                        </div>
                    </div>
                </div>

                <LineTable title={t('Included Assets and Additions')} lines={[...(groupedLines.asset || []), ...(groupedLines.addition || [])]} />
                <LineTable title={t('Deductions and Exclusions')} lines={[...(groupedLines.deduction || []), ...(groupedLines.exclusion || [])]} />

                <div className="mb-8 page-break-inside-avoid">
                    <h2 className="text-lg font-bold mb-3 border-b pb-2">{t('Payments')}</h2>
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2 text-left">{t('Date')}</th>
                                <th className="border p-2 text-left">{t('Bank Account')}</th>
                                <th className="border p-2 text-left">{t('Reference')}</th>
                                <th className="border p-2 text-right">{t('Amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calculation.payments.length > 0 ? calculation.payments.map((payment) => (
                                <tr key={payment.id}>
                                    <td className="border p-2">{formatDate(payment.payment_date)}</td>
                                    <td className="border p-2">{payment.bank_account?.account_name || '-'}</td>
                                    <td className="border p-2">{payment.reference_number || payment.expense?.expense_number || '-'}</td>
                                    <td className="border p-2 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td className="border p-4 text-center text-gray-500" colSpan={4}>{t('No payments recorded yet')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mb-8 page-break-inside-avoid">
                    <h2 className="text-lg font-bold mb-3 border-b pb-2">{t('Instructions and Rulings Used')}</h2>
                    <div className="grid grid-cols-1 gap-3 text-sm">
                        {guidance.map((item) => (
                            <div key={item.title} className="border rounded p-3">
                                <p className="font-semibold">{t(item.title)}</p>
                                <p className="text-gray-700 mt-1">{t(item.body)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {calculation.notes && (
                    <div className="mb-8 page-break-inside-avoid">
                        <h2 className="text-lg font-bold mb-3 border-b pb-2">{t('Notes')}</h2>
                        <p className="text-sm whitespace-pre-wrap">{calculation.notes}</p>
                    </div>
                )}

                <div className="text-xs text-gray-600 border-t pt-4">
                    <p>{t('This report is generated from a finalized snapshot. Later changes to invoices, stock, or bank balances do not change this report.')}</p>
                    <p>{t('This system helps with calculation and documentation and does not replace a qualified religious or accounting review.')}</p>
                </div>
            </div>
        </div>
    );
}
