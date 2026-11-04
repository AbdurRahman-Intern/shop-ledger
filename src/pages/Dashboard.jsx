// DASHBOARD — answers the shopkeeper's daily questions, nothing more:
//   "How much am I owed?"  "What did I collect?"  "Who should I chase?"  "What just happened?"
// Totals/charts are for owners & managers; employees get quick actions and recent activity.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, HandCoins, Users, Banknote, UserPlus, Sparkles, ArrowUpRight } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { useUiStore } from '../store/uiStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { usePermission, useTitle } from '../hooks/useMisc.js';
import { Card, CardHeader, PageHeader, Stat, Money, Avatar, EmptyState } from '../components/ui/Display.jsx';
import Button from '../components/ui/Button.jsx';
import { Segmented } from '../components/ui/Form.jsx';
import { TrendChart, AgingChart, ChartLegend } from '../components/shared/Charts.jsx';
import { SyncBadge } from '../components/shared/Badges.jsx';
import { agingBuckets, attentionList, dailySeries, monthlySeries, periodSummary } from '../lib/finance.js';
import { addDays, addMonths, eachDay, monthKey, startOfMonth } from '../lib/dates.js';

export default function Dashboard() {
  const { t, fmt } = useI18n();
  useTitle(t('nav.dashboard'));
  const user = useAuthStore((s) => s.user);
  const openModal = useUiStore((s) => s.openModal);
  const canSeeTotals = usePermission('dashboard.financials');
  const { data, ledger, customerById, today, overdueDays } = useLedger();
  const [range, setRange] = useState('daily');

  const calc = useMemo(() => {
    const month = periodSummary(data, startOfMonth(today), today);
    const day = periodSummary(data, today, today);
    const daily = dailySeries(data, eachDay(addDays(today, -29), today)).map((d) => ({ ...d, label: fmt.date(d.date, 'short') }));
    const months = Array.from({ length: 6 }, (_, i) => addMonths(monthKey(today), i - 5));
    const monthly = monthlySeries(data, months).map((m) => ({ ...m, label: fmt.month(m.month) }));
    return { month, day, daily, monthly, aging: agingBuckets(data, ledger), attention: attentionList(ledger, data.customers, 5) };
  }, [data, ledger, today, fmt]);

  const recentCredits = [...data.credits].filter((c) => !c.voidedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentPayments = [...data.payments].filter((p) => !p.voidedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const { outstanding, collected, creditSales, debtorCount } = ledger.totals;
  const rate = creditSales ? collected / creditSales : 0;

  if (data.customers.length === 0) {
    return (
      <>
        <PageHeader title={t('dashboard.greeting', { name: user?.name?.split(' ')[0] })} subtitle={t('dashboard.subtitle')} />
        <Card><EmptyState icon={Sparkles} title={t('dashboard.emptyTitle')} text={t('dashboard.emptyText')} action={<Button icon={UserPlus} onClick={() => openModal('customer', {})}>{t('customers.add')}</Button>} /></Card>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('dashboard.greeting', { name: user?.name?.split(' ')[0] })} subtitle={t('dashboard.subtitle')}
        actions={<div className="flex gap-2 lg:hidden"><Button size="sm" variant="accent" icon={Banknote} onClick={() => openModal('payment', {})}>{t('quick.takePayment')}</Button><Button size="sm" variant="secondary" icon={HandCoins} onClick={() => openModal('credit', {})}>{t('quick.newCredit')}</Button></div>} />

      {canSeeTotals ? (
        <>
          <section aria-label={t('dashboard.allTime')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('dashboard.outstanding')} icon={Wallet} tone="accent" value={<Money minor={outstanding} />} sub={<Link to="/reports" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">{t('nav.reports')}<ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden /></Link>} className="col-span-2 lg:col-span-1" />
            <Stat label={t('dashboard.collected')} icon={Banknote} tone="success" value={<Money minor={collected} />} sub={t('dashboard.ofAllCredit', { percent: fmt.percent(rate) })} />
            <Stat label={t('dashboard.creditSales')} icon={HandCoins} tone="brand" value={<Money minor={creditSales} />} sub={t('dashboard.allTime')} />
            <Stat label={t('dashboard.debtors')} icon={Users} tone="info" value={fmt.number(debtorCount)} sub={t('dashboard.customersOwe')} className="col-span-2 lg:col-span-1" />
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {[['daySummary', calc.day], ['monthSummary', calc.month]].map(([k, s]) => (
              <Card key={k} className="p-5">
                <h2 className="text-sm font-bold text-ink-500">{t(`dashboard.${k}`)}</h2>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-ink-500">{t('dashboard.credit')}</p><p className="mt-0.5 text-lg font-bold text-accent-700"><Money minor={s.credit} /></p><p className="text-xs text-ink-400">{t('dashboard.creditsCount', { count: fmt.number(s.creditCount) })}</p></div>
                  <div><p className="text-xs text-ink-500">{t('dashboard.collections')}</p><p className="mt-0.5 text-lg font-bold text-mint-700"><Money minor={s.collected} /></p><p className="text-xs text-ink-400">{t('dashboard.paymentsCount', { count: fmt.number(s.paymentCount) })}</p></div>
                </div>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader title={t('dashboard.trend')} subtitle={range === 'daily' ? t('dashboard.trendSub') : t('dashboard.last6')}
              action={<Segmented label={t('dashboard.trend')} value={range} onChange={setRange} options={[{ value: 'daily', label: t('dashboard.daily') }, { value: 'monthly', label: t('dashboard.monthly') }]} />} />
            <div className="px-3 pb-4 pt-3 sm:px-5"><TrendChart data={range === 'daily' ? calc.daily : calc.monthly} variant={range === 'daily' ? 'area' : 'bar'} /><div className="mt-2 px-2"><ChartLegend /></div></div>
          </Card>

          <section className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader title={t('dashboard.aging')} subtitle={t('dashboard.agingSub')} /><div className="p-4 pt-2"><AgingChart buckets={calc.aging} /></div></Card>
            <Card>
              <CardHeader title={t('dashboard.attention')} subtitle={t('dashboard.attentionSub', { days: fmt.number(overdueDays) })} />
              {calc.attention.length === 0 ? <EmptyState icon={Sparkles} title={t('dashboard.attentionEmpty')} text={t('dashboard.attentionEmptyText', { days: fmt.number(overdueDays) })} className="py-8" /> : (
                <ul className="mt-2 divide-y divide-ink-100 px-2 pb-2">
                  {calc.attention.map(({ customer, stats }) => (
                    <li key={customer.id}>
                      <Link to={`/customers/${customer.id}`} className="touch flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50">
                        <Avatar name={customer.name} size="sm" />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{customer.name}</span><span className="block text-xs text-accent-700">{t('dashboard.owesFor', { days: fmt.number(stats.oldestOpenAgeDays) })}</span></span>
                        <Money minor={stats.overdueAmount} tone="debt" className="font-bold" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      ) : (
        <Card className="p-5"><h2 className="font-bold">{t('dashboard.restrictedTitle')}</h2><p className="mt-1 text-ink-500">{t('dashboard.restricted')}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Button variant="accent" icon={Banknote} onClick={() => openModal('payment', {})}>{t('quick.takePayment')}</Button>
            <Button variant="secondary" icon={HandCoins} onClick={() => openModal('credit', {})}>{t('quick.newCredit')}</Button>
            <Button variant="secondary" icon={UserPlus} onClick={() => openModal('customer', {})}>{t('quick.addCustomer')}</Button>
          </div></Card>
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('dashboard.recentCredit')} action={<Link to="/credits" className="text-sm font-semibold text-brand-700 hover:underline">{t('common.seeAll')}</Link>} />
          <ul className="mt-2 divide-y divide-ink-100 px-2 pb-2">
            {recentCredits.map((c) => (
              <li key={c.id}>
                <Link to={`/customers/${c.customerId}`} className="touch flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50">
                  <Avatar name={customerById.get(c.customerId)?.name} size="sm" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{customerById.get(c.customerId)?.name}</span><span className="block truncate text-xs text-ink-500">{c.description || '—'} · {fmt.date(c.date, 'short')}</span></span>
                  <SyncBadge compact status={c.syncStatus} /><Money minor={c.amount} className="font-semibold" />
                </Link>
              </li>
            ))}
            {recentCredits.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-500">{t('credit.emptyTitle')}</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title={t('dashboard.recentPayments')} action={<Link to="/payments" className="text-sm font-semibold text-brand-700 hover:underline">{t('common.seeAll')}</Link>} />
          <ul className="mt-2 divide-y divide-ink-100 px-2 pb-2">
            {recentPayments.map((p) => (
              <li key={p.id}>
                <button onClick={() => openModal('receipt', { paymentId: p.id })} className="touch flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-ink-50">
                  <Avatar name={customerById.get(p.customerId)?.name} size="sm" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{customerById.get(p.customerId)?.name}</span><span className="block truncate text-xs text-ink-500">{t(`methods.${p.method}`)} · {fmt.date(p.date, 'short')}</span></span>
                  <SyncBadge compact status={p.syncStatus} /><Money minor={p.amount} tone="positive" className="font-semibold" />
                </button>
              </li>
            ))}
            {recentPayments.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-500">{t('payment.emptyTitle')}</li>}
          </ul>
        </Card>
      </section>
    </div>
  );
}
