// CUSTOMER PROFILE — the complete financial relationship with one customer on a single page:
//   who they are → what they owe → which credits are unpaid → everything that ever happened.
// "Take payment" is the primary (orange) action because it is what the shopkeeper does most.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Phone, Pencil, Archive, ArchiveRestore, FileText, HandCoins, Banknote, ArrowLeft, AlertTriangle, ReceiptText, Ban } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useUiStore } from '../store/uiStore.js';
import { useDataStore } from '../store/dataStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { usePermission, useTitle, useErrorText } from '../hooks/useMisc.js';
import { Card, CardHeader, Avatar, Money, Badge, EmptyState, ProgressBar } from '../components/ui/Display.jsx';
import Button from '../components/ui/Button.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import VoidDialog from '../components/shared/VoidDialog.jsx';
import { CreditStatusBadge, SyncBadge } from '../components/shared/Badges.jsx';
import { cx } from '../lib/utils.js';

export default function CustomerDetail() {
  const { id } = useParams();
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const openModal = useUiStore((s) => s.openModal);
  const toast = useUiStore((s) => s.toast);
  const setArchived = useDataStore((s) => s.setArchived);
  const voidPayment = useDataStore((s) => s.voidPayment);
  const voidCredit = useDataStore((s) => s.voidCredit);
  const canArchive = usePermission('customers.archive');
  const canVoid = usePermission('records.void');
  const { data, ledger, overdueDays } = useLedger();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [voiding, setVoiding] = useState(null); // { kind: 'payment'|'credit', record }

  const customer = data.customers.find((c) => c.id === id);
  useTitle(customer?.name);
  const stats = customer ? ledger.customers.get(customer.id) : null;

  // Merge credits and payments into one chronological timeline (newest first).
  const timeline = useMemo(() => {
    if (!customer) return [];
    return [
      ...data.credits.filter((c) => c.customerId === id).map((c) => ({ kind: 'credit', date: c.date, at: c.createdAt, record: c })),
      ...data.payments.filter((p) => p.customerId === id).map((p) => ({ kind: 'payment', date: p.date, at: p.createdAt, record: p })),
    ].sort((a, b) => b.date.localeCompare(a.date) || b.at.localeCompare(a.at));
  }, [data, id, customer]);

  if (!customer) {
    // Also what a user sees when opening a link that belongs to another business.
    return <EmptyState icon={Ban} title={t('customers.notFound')} text={t('customers.notFoundText')} action={<Link to="/customers"><Button variant="secondary">{t('customers.backToList')}</Button></Link>} />;
  }

  const hasDebt = stats.balance > 0;
  const doArchive = async () => {
    try { await setArchived(customer.id, !customer.archived); toast('success', t(customer.archived ? 'customers.restored' : 'customers.archived')); setArchiveOpen(false); }
    catch (e) { toast('error', errorText(e)); setArchiveOpen(false); }
  };

  return (
    <div className="space-y-5">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"><ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />{t('customers.backToList')}</Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={customer.name} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-extrabold tracking-tight">{customer.name}</h1>
                {customer.archived && <Badge>{t('customers.archivedBadge')}</Badge>}{customer.syncStatus !== 'synced' && <SyncBadge status={customer.syncStatus} />}</div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-500">
                {customer.phone && <a href={`tel:${customer.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"><Phone className="h-3.5 w-3.5" aria-hidden /><bdi dir="ltr">{customer.phone}</bdi></a>}
                {customer.address && <span>{customer.address}</span>}
                <span>{t('customers.since', { date: fmt.date(customer.createdAt.slice(0, 10)) })}</span>
              </p>
              {customer.note && <p className="mt-1 text-sm text-ink-600">“{customer.note}”</p>}
            </div>
          </div>
          <div className="sm:text-end">
            <p className="text-sm font-medium text-ink-500">{t('customers.balanceDue')}</p>
            <p className={cx('text-3xl font-extrabold tracking-tight', hasDebt ? 'text-accent-700' : 'text-mint-700')}><Money minor={stats.balance} /></p>
            {!hasDebt && <p className="text-sm text-mint-700">{t('customers.settledText')}</p>}
          </div>
        </div>

        {stats.overdueAmount > 0 && (
          <p role="note" className="mt-4 flex items-center gap-2 rounded-xl bg-accent-50 p-3 text-sm font-medium text-accent-700"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />{t('customers.overdueAlert', { amount: fmt.money(stats.overdueAmount), days: fmt.number(overdueDays) })}</p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!customer.archived && <Button variant="accent" icon={Banknote} disabled={!hasDebt} onClick={() => openModal('payment', { customerId: customer.id })}>{t('quick.takePayment')}</Button>}
          {!customer.archived && <Button icon={HandCoins} onClick={() => openModal('credit', { customerId: customer.id })}>{t('quick.newCredit')}</Button>}
          <Button variant="secondary" icon={FileText} onClick={() => navigate(`/customers/${customer.id}/statement`)}>{t('customers.statement')}</Button>
          <Button variant="secondary" icon={Pencil} onClick={() => openModal('customer', { customer })}>{t('common.edit')}</Button>
          {canArchive && <Button variant="ghost" icon={customer.archived ? ArchiveRestore : Archive} onClick={() => setArchiveOpen(true)}>{t(customer.archived ? 'customers.unarchive' : 'customers.archive')}</Button>}
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4 text-center sm:text-start">
          {[['customers.totalCredit', <Money minor={stats.totalCredit} />], ['customers.totalPaid', <Money minor={stats.totalPaid} tone="positive" />], ['customers.creditCount', fmt.number(timeline.filter((x) => x.kind === 'credit' && !x.record.voidedAt).length)]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-ink-500">{t(k)}</dt><dd className="mt-0.5 font-bold">{v}</dd></div>
          ))}
        </dl>
      </Card>

      {/* Unpaid credits: each one with its own progress, so partial payments are obvious. */}
      {stats.openCredits.length > 0 && (
        <Card>
          <CardHeader title={t('customers.openCredits')} />
          <ul className="mt-2 divide-y divide-ink-100 px-2 pb-2">
            {stats.openCredits.map((c) => {
              const st = ledger.creditState.get(c.id);
              return (
                <li key={c.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{c.description || t('payment.willReduce')}</p><CreditStatusBadge status={st.status} /></div>
                    <p className="text-sm text-ink-500">{fmt.date(c.date)} · {t('common.days', { count: fmt.number(st.ageDays) })}</p>
                    <div className="mt-2 max-w-xs"><ProgressBar value={st.paid} max={c.amount} label={t('status.partial')} /></div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-end"><Money minor={st.remaining} tone="debt" className="block font-bold" /><span className="text-xs text-ink-500">{t('customers.ofTotal', { amount: fmt.money(c.amount) })}</span></div>
                    {!customer.archived && <Button size="sm" variant="soft" onClick={() => openModal('payment', { customerId: customer.id, creditId: c.id })}>{t('quick.takePayment')}</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title={t('customers.history')} subtitle={t('customers.timeline')} />
        {timeline.length === 0 ? <EmptyState icon={ReceiptText} title={t('customers.noHistory')} text={t('customers.noHistoryText')} /> : (
          <ul className="mt-2 divide-y divide-ink-100 px-2 pb-2">
            {timeline.map(({ kind, record }) => {
              const voided = !!record.voidedAt;
              const isPay = kind === 'payment';
              const st = !isPay ? ledger.creditState.get(record.id) : null;
              return (
                <li key={record.id} className={cx('flex items-center gap-3 px-3 py-3', voided && 'opacity-60')}>
                  <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', isPay ? 'bg-mint-50 text-mint-600' : 'bg-accent-50 text-accent-600')}>{isPay ? <Banknote className="h-5 w-5" aria-hidden /> : <HandCoins className="h-5 w-5" aria-hidden />}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cx('truncate font-medium', voided && 'line-through')}>{isPay ? `${t('payment.receipt')} ${record.serverNumber || record.number} · ${t(`methods.${record.method}`)}` : record.description || t('statement.creditSale')}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-500">{fmt.date(record.date)}
                      {voided ? <Badge>{t('status.void')}</Badge> : st ? <CreditStatusBadge status={st.status} /> : null}
                      <SyncBadge compact status={record.syncStatus} /></p>
                  </div>
                  <div className="text-end"><Money minor={record.amount} tone={isPay ? 'positive' : 'debt'} className={cx('font-bold', voided && 'line-through')} /></div>
                  <div className="flex shrink-0 gap-0.5">
                    {isPay && <button onClick={() => openModal('receipt', { paymentId: record.id })} aria-label={t('payment.viewReceipt')} title={t('payment.viewReceipt')} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><ReceiptText className="h-[18px] w-[18px]" /></button>}
                    {canVoid && !voided && <button onClick={() => setVoiding({ kind, record })} aria-label={t('common.void')} title={t('common.void')} className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-500"><Ban className="h-[18px] w-[18px]" /></button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog open={archiveOpen} onClose={() => setArchiveOpen(false)} onConfirm={doArchive}
        title={customer.archived ? t('customers.unarchive') : t('customers.archiveTitle', { name: customer.name })}
        text={customer.archived ? undefined : t('customers.archiveText')} confirmLabel={customer.archived ? t('customers.unarchive') : t('customers.archive')} />
      <VoidDialog open={!!voiding} onClose={() => setVoiding(null)}
        title={voiding?.kind === 'payment' ? t('payment.voidTitle') : t('credit.voidTitle')}
        text={voiding?.kind === 'payment' ? t('payment.voidText', { amount: fmt.money(voiding.record.amount) }) : t('credit.voidText')}
        onConfirm={async (reason) => {
          if (voiding.kind === 'payment') await voidPayment(voiding.record.id, reason); else await voidCredit(voiding.record.id, reason);
          toast('success', t(voiding.kind === 'payment' ? 'payment.voided' : 'credit.voided'));
        }} />
    </div>
  );
}
