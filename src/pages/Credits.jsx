// CREDIT SALES LIST — every credit sale, newest first, with payment status and void action.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HandCoins, Search, Ban } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useUiStore } from '../store/uiStore.js';
import { useDataStore } from '../store/dataStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { usePermission, useTitle } from '../hooks/useMisc.js';
import { Card, PageHeader, Money, EmptyState, Avatar, Badge } from '../components/ui/Display.jsx';
import { TextInput, Segmented } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import VoidDialog from '../components/shared/VoidDialog.jsx';
import { CreditStatusBadge, SyncBadge } from '../components/shared/Badges.jsx';
import { normalizeSearch, cx } from '../lib/utils.js';

export default function Credits() {
  const { t, fmt } = useI18n();
  useTitle(t('nav.credits'));
  const openModal = useUiStore((s) => s.openModal);
  const toast = useUiStore((s) => s.toast);
  const voidCredit = useDataStore((s) => s.voidCredit);
  const canVoid = usePermission('records.void');
  const { data, ledger, customerById } = useLedger();
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [voiding, setVoiding] = useState(null);
  const [limit, setLimit] = useState(50);

  const rows = useMemo(() => {
    const nq = normalizeSearch(query);
    return [...data.credits]
      .filter((c) => {
        const st = ledger.creditState.get(c.id)?.status;
        if (status !== 'all' && st !== status) return false;
        if (!nq) return true;
        return normalizeSearch(customerById.get(c.customerId)?.name || '').includes(nq) || normalizeSearch(c.description || '').includes(nq);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data.credits, ledger, customerById, status, query]);

  const opts = ['all', 'unpaid', 'partial', 'paid', 'void'].map((s) => ({ value: s, label: s === 'all' ? t('common.all') : t(`status.${s}`) }));

  return (
    <>
      <PageHeader title={t('credit.list')} subtitle={t('credit.listSubtitle')} actions={<Button icon={HandCoins} onClick={() => openModal('credit', {})}>{t('quick.newCredit')}</Button>} />
      <div className="mb-4 space-y-3">
        <div className="relative"><Search className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" aria-hidden />
          <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('customers.searchPh')} aria-label={t('common.search')} className="ps-10" /></div>
        <Segmented label={t('credit.filterStatus')} value={status} onChange={(v) => { setStatus(v); setLimit(50); }} options={opts} />
      </div>
      <Card as="div" className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={HandCoins} title={data.credits.length ? t('customers.noMatchTitle') : t('credit.emptyTitle')} text={data.credits.length ? t('customers.noMatchText') : t('credit.emptyText')}
            action={!data.credits.length && <Button icon={HandCoins} onClick={() => openModal('credit', {})}>{t('quick.newCredit')}</Button>} />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {rows.slice(0, limit).map((c) => {
                const st = ledger.creditState.get(c.id);
                const customer = customerById.get(c.customerId);
                const voided = !!c.voidedAt;
                return (
                  <li key={c.id} className={cx('flex items-center gap-3 px-4 py-3.5', voided && 'opacity-60')}>
                    <Avatar name={customer?.name} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/customers/${c.customerId}`} className={cx('block truncate font-semibold hover:underline', voided && 'line-through')}>{customer?.name}</Link>
                      <p className="truncate text-sm text-ink-500">{c.description || '—'} · {fmt.date(c.date, 'short')}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2"><CreditStatusBadge status={st.status} />
                        {st.status === 'partial' && <span className="text-xs text-ink-500">{t('customers.remaining', { amount: fmt.money(st.remaining) })}</span>}
                        {c.syncStatus !== 'synced' && <SyncBadge compact status={c.syncStatus} />}
                        {c.voidReason && c.voidReason !== 'sync_discarded' && <Badge>{c.voidReason}</Badge>}</div>
                    </div>
                    <Money minor={c.amount} tone="debt" className={cx('font-bold', voided && 'line-through')} />
                    {canVoid && !voided && <button onClick={() => setVoiding(c)} aria-label={t('common.void')} title={t('common.void')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-500"><Ban className="h-[18px] w-[18px]" /></button>}
                  </li>
                );
              })}
            </ul>
            {rows.length > limit && <div className="border-t border-ink-100 p-3 text-center"><Button variant="ghost" onClick={() => setLimit(limit + 50)}>{t('common.more')} ({t('common.showing', { count: fmt.number(limit) })} / {fmt.number(rows.length)})</Button></div>}
          </>
        )}
      </Card>
      <VoidDialog open={!!voiding} onClose={() => setVoiding(null)} title={t('credit.voidTitle')} text={t('credit.voidText')}
        onConfirm={async (reason) => { await voidCredit(voiding.id, reason); toast('success', t('credit.voided')); }} />
    </>
  );
}
