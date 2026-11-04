// REPORTS — four focused views: who owes what, what was collected, credit given, payment log.
// Free plan: core reports + on-screen tables. Basic/Premium: CSV export and monthly breakdowns
// (this is the paid-plan hook: shops that grow want to hand data to an accountant).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Lock, Wallet, Users, Banknote, HandCoins, ReceiptText, BarChart3 } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { useUiStore } from '../store/uiStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { useTitle } from '../hooks/useMisc.js';
import { Card, CardHeader, PageHeader, Stat, Money, EmptyState, TableWrap, Th, Td } from '../components/ui/Display.jsx';
import { Segmented } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import { AgingChart, SimpleBars, CHART_COLORS } from '../components/shared/Charts.jsx';
import { agingBuckets, dailySeries, monthlySeries } from '../lib/finance.js';
import { addDays, addMonths, eachDay, monthKey, startOfMonth, endOfMonth, daysBetween } from '../lib/dates.js';
import { downloadText, toCsv } from '../lib/utils.js';
import { PLANS } from '../config/appConfig.js';

function LockedNote({ text }) {
  const { t } = useI18n();
  return (
    <div className="m-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-accent-300 bg-accent-50 p-4">
      <Lock className="h-5 w-5 text-accent-600" aria-hidden /><p className="min-w-0 flex-1 text-sm font-medium text-accent-700">{text}</p>
      <Link to="/plans"><Button size="sm" variant="accent">{t('reports.upgrade')}</Button></Link>
    </div>
  );
}

export default function Reports() {
  const { t, fmt, decimals } = useI18n();
  useTitle(t('nav.reports'));
  const toast = useUiStore((s) => s.toast);
  const navigate = useNavigate();
  const tenant = useAuthStore((s) => s.tenant);
  const plan = PLANS[tenant.subscription.planId];
  const { data, ledger, customerById, today, overdueDays } = useLedger();
  const [tab, setTab] = useState('outstanding');
  const [period, setPeriod] = useState('last30');

  const range = useMemo(() => {
    const thisMonth = monthKey(today); const lastMonth = addMonths(thisMonth, -1);
    return {
      last7: { from: addDays(today, -6), to: today }, last30: { from: addDays(today, -29), to: today }, last90: { from: addDays(today, -89), to: today },
      thisMonth: { from: startOfMonth(today), to: today }, lastMonth: { from: `${lastMonth}-01`, to: endOfMonth(lastMonth) }, thisYear: { from: `${today.slice(0, 4)}-01-01`, to: today },
    }[period];
  }, [period, today]);

  const inRange = (d) => d >= range.from && d <= range.to;
  const payments = data.payments.filter((p) => !p.voidedAt && inRange(p.date));
  const credits = data.credits.filter((c) => !c.voidedAt && inRange(c.date));
  const sum = (arr) => arr.reduce((s, x) => s + x.amount, 0);

  const exportCsv = (name, rows) => {
    if (!plan.features.csvExport) { toast('warning', t('reports.exportLocked'), { action: { label: t('reports.upgrade'), onClick: () => navigate('/plans') } }); return; }
    downloadText(`${name}-${today}.csv`, toCsv(rows));
    toast('success', t('reports.exported'));
  };
  const ExportBtn = ({ onClick }) => <Button variant="secondary" size="sm" icon={plan.features.csvExport ? Download : Lock} onClick={onClick}>{t('common.export')}</Button>;
  const major = (v) => v / 10 ** decimals;

  const periodPicker = (
    <Segmented label={t('reports.period')} value={period} onChange={setPeriod}
      options={['last7', 'last30', 'last90', 'thisMonth', 'lastMonth', 'thisYear'].map((p) => ({ value: p, label: t(`reports.${p}`) }))} />
  );

  // ---------- Outstanding ----------
  const outstandingRows = useMemo(() => data.customers.map((c) => ({ c, s: ledger.customers.get(c.id) })).filter(({ s }) => s.balance > 0).sort((a, b) => b.s.balance - a.s.balance), [data.customers, ledger]);
  const totals = ledger.totals;
  const overdueTotal = outstandingRows.reduce((s, { s: st }) => s + st.overdueAmount, 0);

  // ---------- Collections / credit series ----------
  const days = eachDay(range.from, range.to);
  const dailyRows = dailySeries(data, days).map((d) => ({ ...d, label: fmt.date(d.date, 'short') }));
  const months = Array.from({ length: 6 }, (_, i) => addMonths(monthKey(today), i - 5));
  const monthlyRows = monthlySeries(data, months).map((m) => ({ ...m, label: fmt.month(m.month) }));
  const bestDay = dailyRows.reduce((b, d) => (d.collected > b.collected ? d : b), { collected: 0 });
  const topCustomers = useMemo(() => {
    const map = new Map();
    credits.forEach((c) => map.set(c.customerId, (map.get(c.customerId) || 0) + c.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [credits]);

  const tabs = [['outstanding', 'outstanding'], ['collections', 'collections'], ['credit', 'credit'], ['payments', 'payments']];

  return (
    <div className="space-y-5">
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
      <Segmented label={t('reports.title')} value={tab} onChange={setTab} options={tabs.map(([v, k]) => ({ value: v, label: t(`reports.tabs.${k}`) }))} />

      {tab === 'outstanding' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('reports.totalOutstanding')} icon={Wallet} tone="accent" value={<Money minor={totals.outstanding} />} />
            <Stat label={t('reports.debtorsCount')} icon={Users} tone="info" value={fmt.number(totals.debtorCount)} />
            <Stat label={t('reports.averageBalance')} icon={BarChart3} tone="brand" value={<Money minor={totals.debtorCount ? Math.round(totals.outstanding / totals.debtorCount) : 0} />} />
            <Stat label={t('reports.overdueTotal')} icon={Wallet} tone="accent" value={<Money minor={overdueTotal} />} sub={t('dashboard.attentionSub', { days: fmt.number(overdueDays) })} />
          </div>
          <Card><CardHeader title={t('reports.agingTitle')} /><div className="p-4"><AgingChart buckets={agingBuckets(data, ledger)} /></div></Card>
          <Card>
            <CardHeader title={t('reports.customerBalances')} action={<ExportBtn onClick={() => exportCsv('outstanding', [[t('reports.col.customer'), t('common.phone'), t('reports.col.balance'), t('reports.col.overdue'), t('reports.col.oldest'), t('reports.col.lastPayment')], ...outstandingRows.map(({ c, s }) => [c.name, c.phone, major(s.balance), major(s.overdueAmount), s.oldestOpenDate, s.lastPaymentDate || ''])])} />} />
            {outstandingRows.length === 0 ? <EmptyState icon={Wallet} title={t('dashboard.attentionEmpty')} /> : (
              <TableWrap className="mt-3">
                <thead><tr><Th>{t('reports.col.customer')}</Th><Th align="end">{t('reports.col.balance')}</Th><Th align="end">{t('reports.col.overdue')}</Th><Th>{t('reports.col.oldest')}</Th><Th>{t('reports.col.lastPayment')}</Th></tr></thead>
                <tbody>{outstandingRows.map(({ c, s }) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <Td><Link to={`/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link></Td>
                    <Td align="end" className="font-bold"><Money minor={s.balance} tone="debt" /></Td>
                    <Td align="end">{s.overdueAmount ? <Money minor={s.overdueAmount} /> : '—'}</Td>
                    <Td>{fmt.date(s.oldestOpenDate, 'short')} <span className="text-xs text-ink-400">({t('common.days', { count: fmt.number(s.oldestOpenAgeDays) })})</span></Td>
                    <Td>{s.lastPaymentDate ? fmt.date(s.lastPaymentDate, 'short') : '—'}</Td>
                  </tr>))}</tbody>
              </TableWrap>
            )}
          </Card>
        </>
      )}

      {tab === 'collections' && (
        <>
          {periodPicker}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('reports.totalCollected')} icon={Banknote} tone="success" value={<Money minor={sum(payments)} />} />
            <Stat label={t('reports.paymentsCount')} icon={ReceiptText} tone="brand" value={fmt.number(payments.length)} />
            <Stat label={t('reports.averagePayment')} icon={BarChart3} tone="info" value={<Money minor={payments.length ? Math.round(sum(payments) / payments.length) : 0} />} />
            <Stat label={t('reports.bestDay')} icon={Banknote} tone="success" value={bestDay.collected ? <Money minor={bestDay.collected} /> : '—'} sub={bestDay.date && bestDay.collected ? fmt.date(bestDay.date, 'medium') : ''} />
          </div>
          <Card><CardHeader title={t('reports.dailyCollections')} />
            {payments.length === 0 ? <EmptyState icon={Banknote} title={t('reports.noData')} text={t('reports.noDataText')} /> : <div className="p-4"><SimpleBars data={dailyRows} dataKey="collected" name={t('dashboard.collections')} /></div>}</Card>
          <Card><CardHeader title={t('reports.monthlyCollections')} subtitle={t('dashboard.last6')} />
            {plan.features.advancedReports ? <div className="p-4"><SimpleBars data={monthlyRows} dataKey="collected" name={t('dashboard.collections')} /></div> : <LockedNote text={t('reports.advancedLocked')} />}</Card>
        </>
      )}

      {tab === 'credit' && (
        <>
          {periodPicker}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label={t('reports.totalCredit')} icon={HandCoins} tone="accent" value={<Money minor={sum(credits)} />} className="col-span-2 lg:col-span-1" />
            <Stat label={t('reports.creditCount')} icon={ReceiptText} tone="brand" value={fmt.number(credits.length)} />
            <Stat label={t('reports.averageCredit')} icon={BarChart3} tone="info" value={<Money minor={credits.length ? Math.round(sum(credits) / credits.length) : 0} />} />
          </div>
          <Card><CardHeader title={t('reports.creditByMonth')} subtitle={t('dashboard.last6')} />
            {plan.features.advancedReports ? <div className="p-4"><SimpleBars data={monthlyRows} dataKey="credit" color={CHART_COLORS.credit} name={t('dashboard.credit')} /></div> : <LockedNote text={t('reports.advancedLocked')} />}</Card>
          <Card><CardHeader title={t('reports.topCustomers')} />
            {topCustomers.length === 0 ? <EmptyState icon={HandCoins} title={t('reports.noData')} text={t('reports.noDataText')} /> : (
              <ul className="mt-2 divide-y divide-ink-100 px-2 pb-2">{topCustomers.map(([id, amount]) => (
                <li key={id}><Link to={`/customers/${id}`} className="touch flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50"><span className="truncate font-medium">{customerById.get(id)?.name}</span><Money minor={amount} className="font-bold" /></Link></li>))}</ul>)}</Card>
        </>
      )}

      {tab === 'payments' && (
        <>
          {periodPicker}
          <Card>
            <CardHeader title={t('nav.payments')} subtitle={`${fmt.number(payments.length)} · ${fmt.money(sum(payments))}`}
              action={<ExportBtn onClick={() => exportCsv('payments', [[t('reports.date'), t('reports.receipt'), t('reports.customer'), t('reports.method'), t('common.amount')], ...payments.map((p) => [p.date, p.serverNumber || p.number, customerById.get(p.customerId)?.name, t(`methods.${p.method}`), major(p.amount)])])} />} />
            {payments.length === 0 ? <EmptyState icon={ReceiptText} title={t('reports.noData')} text={t('reports.noDataText')} /> : (
              <TableWrap className="mt-3">
                <thead><tr><Th>{t('reports.date')}</Th><Th>{t('reports.receipt')}</Th><Th>{t('reports.customer')}</Th><Th>{t('reports.method')}</Th><Th align="end">{t('common.amount')}</Th></tr></thead>
                <tbody>{[...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200).map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50"><Td className="whitespace-nowrap">{fmt.date(p.date, 'short')}</Td><Td><bdi dir="ltr">{p.serverNumber || p.number}</bdi></Td>
                    <Td><Link to={`/customers/${p.customerId}`} className="font-medium hover:underline">{customerById.get(p.customerId)?.name}</Link></Td><Td>{t(`methods.${p.method}`)}</Td><Td align="end" className="font-bold"><Money minor={p.amount} tone="positive" /></Td></tr>))}</tbody>
              </TableWrap>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
