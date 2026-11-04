// CUSTOMER LIST — search, filter, sort. Built for fast lookup: type 2 letters, tap the row.
// Archived customers are hidden by default but never deleted (their history stays in reports).
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Users, ChevronRight, Phone } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useUiStore } from '../store/uiStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { useDebounced, useTitle } from '../hooks/useMisc.js';
import { Card, PageHeader, Avatar, Money, Badge, EmptyState, ProgressBar } from '../components/ui/Display.jsx';
import { TextInput, SelectInput, Segmented } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import { SyncBadge } from '../components/shared/Badges.jsx';
import { normalizeSearch } from '../lib/utils.js';
import { PLANS } from '../config/appConfig.js';

export default function Customers() {
  const { t, fmt } = useI18n();
  useTitle(t('nav.customers'));
  const [params, setParams] = useSearchParams();
  const openModal = useUiStore((s) => s.openModal);
  const planId = useAuthStore((s) => s.tenant.subscription.planId);
  const { data, ledger } = useLedger();
  const [query, setQuery] = useState(params.get('q') || '');
  const filter = params.get('f') || 'all';
  const [sort, setSort] = useState('balance');
  const q = useDebounced(query, 150);

  const setFilter = (f) => setParams((p) => { const n = new URLSearchParams(p); f === 'all' ? n.delete('f') : n.set('f', f); return n; }, { replace: true });

  const rows = useMemo(() => {
    const nq = normalizeSearch(q);
    let list = data.customers
      .map((c) => ({ c, s: ledger.customers.get(c.id) }))
      .filter(({ c }) => (filter === 'archived' ? c.archived : !c.archived))
      .filter(({ c }) => !nq || normalizeSearch(c.name).includes(nq) || normalizeSearch(c.phone || '').includes(nq));
    if (filter === 'owing') list = list.filter(({ s }) => s.balance > 0);
    if (filter === 'overdue') list = list.filter(({ s }) => s.overdueAmount > 0);
    if (filter === 'settled') list = list.filter(({ s }) => s.balance === 0);
    const last = ({ s, c }) => [s.lastPaymentDate, s.lastCreditDate].filter(Boolean).sort().pop() || c.createdAt.slice(0, 10);
    const sorters = {
      balance: (a, b) => b.s.balance - a.s.balance || a.c.name.localeCompare(b.c.name),
      name: (a, b) => a.c.name.localeCompare(b.c.name),
      recent: (a, b) => last(b).localeCompare(last(a)),
      oldest: (a, b) => b.s.oldestOpenAgeDays - a.s.oldestOpenAgeDays,
    };
    return list.sort(sorters[sort]);
  }, [data.customers, ledger, q, filter, sort]);

  const activeCount = data.customers.filter((c) => !c.archived).length;
  const limit = PLANS[planId].limits.customers;
  const filters = ['all', 'owing', 'overdue', 'settled', 'archived'];
  const filterLabel = { all: 'filterAll', owing: 'filterOwing', overdue: 'filterOverdue', settled: 'filterSettled', archived: 'filterArchived' };

  return (
    <>
      <PageHeader title={t('customers.title')} subtitle={t('customers.subtitle', { count: fmt.number(activeCount) })}
        actions={<Button icon={UserPlus} onClick={() => openModal('customer', {})}>{t('customers.add')}</Button>} />

      {limit !== null && activeCount >= limit * 0.8 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-accent-200 bg-accent-50 p-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-accent-700">{activeCount >= limit ? t('customers.limitReached', { limit: fmt.number(limit) }) : t('plans.nearLimit')}</p><div className="mt-2 max-w-xs"><ProgressBar value={activeCount} max={limit} tone="warning" label={t('plans.usageCustomers')} /></div></div>
          <Link to="/plans"><Button size="sm" variant="accent">{t('reports.upgrade')}</Button></Link>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" aria-hidden />
          <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('customers.searchPh')} aria-label={t('common.search')} className="ps-10" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-600"><span className="shrink-0">{t('customers.sort')}</span>
          <SelectInput value={sort} onChange={(e) => setSort(e.target.value)} className="min-w-[10rem]">
            {['balance', 'name', 'recent', 'oldest'].map((s) => <option key={s} value={s}>{t(`customers.sort${s[0].toUpperCase()}${s.slice(1)}`)}</option>)}
          </SelectInput>
        </label>
      </div>
      <Segmented className="mb-4" label={t('common.filter')} value={filter} onChange={setFilter} options={filters.map((f) => ({ value: f, label: t(`customers.${filterLabel[f]}`) }))} />

      <Card as="div" className="overflow-hidden">
        {data.customers.length === 0 ? (
          <EmptyState icon={Users} title={t('customers.emptyTitle')} text={t('customers.emptyText')} action={<Button icon={UserPlus} onClick={() => openModal('customer', {})}>{t('customers.add')}</Button>} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Search} title={t('customers.noMatchTitle')} text={t('customers.noMatchText')} />
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map(({ c, s }) => {
              const last = [s.lastPaymentDate, s.lastCreditDate].filter(Boolean).sort().pop();
              return (
                <li key={c.id}>
                  <Link to={`/customers/${c.id}`} className="touch flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:gap-4">
                    <Avatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="truncate font-semibold">{c.name}</span>
                        {c.archived && <Badge>{t('customers.archivedBadge')}</Badge>}
                        {s.overdueAmount > 0 && !c.archived && <Badge tone="warning">{t('status.overdue')}</Badge>}
                        {c.syncStatus !== 'synced' && <SyncBadge compact status={c.syncStatus} />}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-ink-500">
                        {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden /><bdi dir="ltr">{c.phone}</bdi></span>}
                        <span>{last ? t('customers.lastActivity', { date: fmt.date(last, 'short') }) : t('customers.noActivity')}</span>
                      </span>
                    </span>
                    <span className="text-end">
                      {s.balance > 0 ? <><Money minor={s.balance} tone="debt" className="block font-bold" /><span className="text-xs text-ink-500">{t('status.owes')}</span></>
                        : <span className="text-sm font-medium text-mint-700">{t('customers.settledText')}</span>}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-300 sm:block rtl:-scale-x-100" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
