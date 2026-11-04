// PAYMENT HISTORY — every payment received, with receipt access and void action.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Search, Ban, ReceiptText } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useUiStore } from '../store/uiStore.js';
import { useDataStore } from '../store/dataStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { usePermission, useTitle } from '../hooks/useMisc.js';
import { Card, PageHeader, Money, EmptyState, Avatar, Badge, Stat } from '../components/ui/Display.jsx';
import { TextInput, SelectInput, Segmented } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import VoidDialog from '../components/shared/VoidDialog.jsx';
import { SyncBadge } from '../components/shared/Badges.jsx';
import { normalizeSearch, cx } from '../lib/utils.js';
import { PAYMENT_METHODS } from '../config/appConfig.js';
import { addDays, startOfMonth } from '../lib/dates.js';

export default function Payments() {
  const { t, fmt } = useI18n();
  useTitle(t('nav.payments'));
  const openModal = useUiStore((s) => s.openModal);
  const toast = useUiStore((s) => s.toast);
  const voidPayment = useDataStore((s) => s.voidPayment);
  const canVoid = usePermission('records.void');
  const { data, customerById, today } = useLedger();
  const [period, setPeriod] = useState('all');
  const [method, setMethod] = useState('all');
  const [query, setQuery] = useState('');
  const [voiding, setVoiding] = useState(null);
  const [limit, setLimit] = useState(50);

  const from = { today, week: addDays(today, -6), month: startOfMonth(today), all: '0000-01-01' }[period];
  const rows = useMemo(() => {
    const nq = normalizeSearch(query);
    return [...data.payments]
      .filter((p) => p.date >= from && (method === 'all' || p.method === method))
      .filter((p) => !nq || normalizeSearch(customerById.get(p.customerId)?.name || '').includes(nq) || normalizeSearch(p.serverNumber || p.number || '').includes(nq))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data.payments, customerById, from, method, query]);

  const active = rows.filter((p) => !p.voidedAt);
  const total = active.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title={t('payment.list')} subtitle={t('payment.listSubtitle')} actions={<Button variant="accent" icon={Banknote} onClick={() => openModal('payment', {})}>{t('quick.takePayment')}</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat label={t('payment.collectedInPeriod')} icon={Banknote} tone="success" value={<Money minor={total} />} />
        <Stat label={t('payment.paymentsInPeriod')} icon={ReceiptText} tone="brand" value={fmt.number(active.length)} />
      </div>
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" aria-hidden />
            <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('customers.searchPh')} aria-label={t('common.search')} className="ps-10" /></div>
          <SelectInput value={method} onChange={(e) => setMethod(e.target.value)} aria-label={t('payment.filterMethod')} className="md:w-52">
            <option value="all">{t('payment.allMethods')}</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`methods.${m}`)}</option>)}
          </SelectInput>
        </div>
        <Segmented label={t('reports.period')} value={period} onChange={(v) => { setPeriod(v); setLimit(50); }}
          options={[{ value: 'all', label: t('statement.allTime') }, { value: 'today', label: t('common.today') }, { value: 'week', label: t('reports.last7') }, { value: 'month', label: t('reports.thisMonth') }]} />
      </div>
      <Card as="div" className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Banknote} title={data.payments.length ? t('customers.noMatchTitle') : t('payment.emptyTitle')} text={data.payments.length ? t('customers.noMatchText') : t('payment.emptyText')}
            action={!data.payments.length && <Button variant="accent" icon={Banknote} onClick={() => openModal('payment', {})}>{t('quick.takePayment')}</Button>} />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {rows.slice(0, limit).map((p) => {
                const customer = customerById.get(p.customerId);
                const voided = !!p.voidedAt;
                return (
                  <li key={p.id} className={cx('flex items-center gap-3 px-4 py-3.5', voided && 'opacity-60')}>
                    <Avatar name={customer?.name} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/customers/${p.customerId}`} className={cx('block truncate font-semibold hover:underline', voided && 'line-through')}>{customer?.name}</Link>
                      <p className="truncate text-sm text-ink-500"><bdi dir="ltr">{p.serverNumber || p.number}</bdi> · {t(`methods.${p.method}`)} · {fmt.date(p.date, 'short')}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">{voided && <Badge>{t('status.void')}</Badge>}<SyncBadge compact={p.syncStatus === 'synced'} status={p.syncStatus} />{p.note && <span className="truncate text-xs text-ink-500">{p.note}</span>}</div>
                    </div>
                    <Money minor={p.amount} tone="positive" className={cx('font-bold', voided && 'line-through')} />
                    <div className="flex shrink-0">
                      <button onClick={() => openModal('receipt', { paymentId: p.id })} aria-label={t('payment.viewReceipt')} title={t('payment.viewReceipt')} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><ReceiptText className="h-[18px] w-[18px]" /></button>
                      {canVoid && !voided && <button onClick={() => setVoiding(p)} aria-label={t('common.void')} title={t('common.void')} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-500"><Ban className="h-[18px] w-[18px]" /></button>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {rows.length > limit && <div className="border-t border-ink-100 p-3 text-center"><Button variant="ghost" onClick={() => setLimit(limit + 50)}>{t('common.more')}</Button></div>}
          </>
        )}
      </Card>
      <VoidDialog open={!!voiding} onClose={() => setVoiding(null)} title={t('payment.voidTitle')} text={voiding ? t('payment.voidText', { amount: fmt.money(voiding.amount) }) : ''}
        onConfirm={async (reason) => { await voidPayment(voiding.id, reason); toast('success', t('payment.voided')); }} />
    </>
  );
}
