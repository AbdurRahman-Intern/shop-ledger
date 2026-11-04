// CUSTOMER STATEMENT — printable, shareable account statement.
// Previous balance + credits − payments = closing balance, with a running balance on every line,
// so the customer can verify it against their own notebook (that is what builds trust).
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Share2, MessageCircle, Copy, Download, Ban } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { useTitle } from '../hooks/useMisc.js';
import { Card, PageHeader, Money, EmptyState, TableWrap, Th, Td } from '../components/ui/Display.jsx';
import { Field, TextInput, Segmented } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import PrintPortal from '../components/shared/PrintPortal.jsx';
import BusinessMark from '../components/shared/BusinessMark.jsx';
import { useShare } from '../components/shared/ReceiptModal.jsx';
import { buildStatement } from '../lib/finance.js';
import { addDays, todayISO, toISODate } from '../lib/dates.js';
import { downloadText, toCsv } from '../lib/utils.js';

function StatementDocument({ customer, tenant, stmt, range }) {
  const { t, fmt } = useI18n();
  return (
    <article className="print-area mx-auto w-full max-w-3xl rounded-2xl border border-ink-200 bg-white p-5 text-ink-900 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <BusinessMark tenant={tenant} align="start" />
        <div className="sm:text-end"><h2 className="text-xl font-extrabold">{t('statement.title')}</h2><p className="text-sm text-ink-500">{fmt.date(range.from)} – {fmt.date(range.to)}</p><p className="text-xs text-ink-400">{t('statement.generatedOn', { date: fmt.date(todayISO()) })}</p></div>
      </div>
      <div className="mt-5 rounded-xl bg-ink-50 p-4">
        <p className="text-xs text-ink-500">{t('statement.preparedFor')}</p>
        <p className="text-lg font-bold">{customer.name}</p>
        {customer.phone && <bdi dir="ltr" className="text-sm text-ink-600">{customer.phone}</bdi>}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['previousBalance', stmt.previousBalance, ''], ['totalCredit', stmt.totalCredits, 'text-accent-700'], ['totalPayments', stmt.totalPayments, 'text-mint-700'], ['closingBalance', stmt.closingBalance, 'text-ink-900 font-extrabold']].map(([k, v, cls]) => (
          <div key={k} className="rounded-xl border border-ink-200 p-3"><dt className="text-xs text-ink-500">{t(`statement.${k}`)}</dt><dd className={`mt-1 text-lg font-bold ${cls}`}><Money minor={v} /></dd></div>
        ))}
      </dl>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink-200">
        <TableWrap>
          <thead><tr><Th>{t('statement.date')}</Th><Th>{t('statement.details')}</Th><Th align="end">{t('statement.debit')}</Th><Th align="end">{t('statement.creditCol')}</Th><Th align="end">{t('statement.balance')}</Th></tr></thead>
          <tbody>
            <tr className="bg-ink-50/60"><Td /><Td className="font-medium text-ink-600">{t('statement.openingRow')}</Td><Td /><Td /><Td align="end" className="font-semibold"><Money minor={stmt.previousBalance} /></Td></tr>
            {stmt.lines.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{fmt.date(l.date, 'short')}</Td>
                <Td>{l.kind === 'payment' ? <><span className="font-medium">{t('statement.payment')}</span> <span className="text-ink-500">· {t(`methods.${l.method}`)} · <bdi dir="ltr">{l.number}</bdi></span></> : <span className="font-medium">{l.description || t('statement.creditSale')}</span>}</Td>
                <Td align="end" className="text-accent-700">{l.debit ? <Money minor={l.debit} /> : ''}</Td>
                <Td align="end" className="text-mint-700">{l.credit ? <Money minor={l.credit} /> : ''}</Td>
                <Td align="end" className="font-semibold"><Money minor={l.balance} /></Td>
              </tr>
            ))}
            {stmt.lines.length === 0 && <tr><Td className="py-8 text-center text-ink-500" colSpan={5}>{t('statement.noLines')}</Td></tr>}
          </tbody>
          <tfoot><tr className="bg-ink-50"><Td className="font-bold" colSpan={4}>{t('statement.closingBalance')}</Td><Td align="end" className="text-lg font-extrabold"><Money minor={stmt.closingBalance} tone={stmt.closingBalance > 0 ? 'debt' : 'positive'} /></Td></tr></tfoot>
        </TableWrap>
      </div>
      <p className="mt-5 text-center text-xs text-ink-400">{t('statement.footer')}</p>
    </article>
  );
}

export default function Statement() {
  const { id } = useParams();
  const { t, fmt } = useI18n();
  const tenant = useAuthStore((s) => s.tenant);
  const { data, customerById, today } = useLedger();
  const { share, whatsapp, copy } = useShare();
  const customer = customerById.get(id);
  useTitle(customer ? `${t('statement.title')} · ${customer.name}` : t('statement.title'));

  const [preset, setPreset] = useState('last90');
  const [custom, setCustom] = useState({ from: addDays(today, -30), to: today });

  const range = useMemo(() => {
    if (preset === 'last30') return { from: addDays(today, -30), to: today };
    if (preset === 'last90') return { from: addDays(today, -90), to: today };
    if (preset === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
    if (preset === 'all') return { from: '0000-01-01', to: today };
    return custom;
  }, [preset, custom, today]);
  const rangeValid = range.from <= range.to;
  const stmt = useMemo(() => (customer && rangeValid ? buildStatement(id, data, range) : null), [customer, id, data, range, rangeValid]);

  if (!customer) return <EmptyState icon={Ban} title={t('customers.notFound')} text={t('customers.notFoundText')} action={<Link to="/customers"><Button variant="secondary">{t('customers.backToList')}</Button></Link>} />;

  // For "all time" show the date of the first record instead of year 0.
  const shownRange = preset === 'all' ? { from: [...data.credits, ...data.payments].filter((r) => r.customerId === id).map((r) => r.date).sort()[0] || today, to: today } : range;
  const text = stmt ? t('statement.shareText', { business: tenant.name, customer: customer.name, from: fmt.date(shownRange.from), to: fmt.date(shownRange.to), balance: fmt.money(stmt.closingBalance) }) : '';

  const exportCsv = () => {
    const rows = [[t('statement.date'), t('statement.details'), t('statement.debit'), t('statement.creditCol'), t('statement.balance')],
      ['', t('statement.openingRow'), '', '', stmt.previousBalance / 10 ** 0],
      ...stmt.lines.map((l) => [l.date, l.kind === 'payment' ? `${t('statement.payment')} ${l.number}` : l.description, l.debit || '', l.credit || '', l.balance])];
    downloadText(`statement-${customer.name.replace(/\s+/g, '-')}-${toISODate(new Date())}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-5">
      <Link to={`/customers/${id}`} className="no-print inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />{customer.name}</Link>
      <PageHeader title={t('statement.title')} subtitle={customer.name}
        actions={<>
          <Button variant="secondary" icon={Download} disabled={!stmt} onClick={exportCsv}>{t('common.export')}</Button>
          <Button variant="secondary" icon={Copy} disabled={!stmt} onClick={() => copy(text)}>{t('receipt.copyText')}</Button>
          <Button variant="secondary" icon={MessageCircle} disabled={!stmt} onClick={() => whatsapp(text, customer.phone)}>{t('receipt.shareWhatsapp')}</Button>
          <Button variant="secondary" icon={Share2} disabled={!stmt} onClick={() => share({ title: t('statement.title'), text })}>{t('common.share')}</Button>
          <Button icon={Printer} disabled={!stmt} onClick={() => window.print()}>{t('common.print')}</Button>
        </>} />

      <Card className="no-print p-4">
        <p className="mb-2 text-sm font-semibold text-ink-700">{t('statement.period')}</p>
        <Segmented label={t('statement.period')} value={preset} onChange={setPreset}
          options={[['last30', 'last30'], ['last90', 'last90'], ['year', 'thisYear'], ['all', 'allTime'], ['custom', 'custom']].map(([v, k]) => ({ value: v, label: t(`statement.${k}`) }))} />
        {preset === 'custom' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={t('statement.from')}>{(p) => <TextInput {...p} type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />}</Field>
            <Field label={t('statement.to')} error={!rangeValid && t('statement.invalidRange')}>{(p) => <TextInput {...p} type="date" value={custom.to} max={today} onChange={(e) => setCustom({ ...custom, to: e.target.value })} invalid={!rangeValid} />}</Field>
          </div>
        )}
      </Card>

      {stmt && <>
        <StatementDocument customer={customer} tenant={tenant} stmt={stmt} range={shownRange} />
        <PrintPortal><StatementDocument customer={customer} tenant={tenant} stmt={stmt} range={shownRange} /></PrintPortal>
      </>}
    </div>
  );
}
