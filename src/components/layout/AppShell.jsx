// APP SHELL — navigation frame around every signed-in page.
//  • Desktop (lg+): fixed sidebar on the START side (left in English, right in Arabic/Dari/Pashto —
//    automatic thanks to logical utilities) + top bar with quick actions.
//  • Phone: slim top bar + bottom tab bar with a centre "+" button for quick actions
//    (thumb-friendly, large touch targets). Everything else lives under "More".
// Navigation items are filtered by the user's role (see PERMISSIONS in appConfig).
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, HandCoins, ReceiptText, BarChart3, UsersRound, Settings, Gem, RefreshCw,
  Plus, MoreHorizontal, LogOut, WifiOff, UserPlus, Banknote,
} from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { useAuthStore } from '../../store/authStore.js';
import { useDataStore } from '../../store/dataStore.js';
import { useUiStore } from '../../store/uiStore.js';
import { useSyncStore } from '../../store/syncStore.js';
import { usePermission, useConnectivityWatcher } from '../../hooks/useMisc.js';
import { scheduleSync, recoverInterruptedOps } from '../../sync/syncEngine.js';
import Button from '../ui/Button.jsx';
import Modal, { ConfirmDialog } from '../ui/Modal.jsx';
import { Avatar, PageSkeleton, ErrorState } from '../ui/Display.jsx';
import ToastHost from '../ui/Toasts.jsx';
import ModalsHost from '../shared/ModalsHost.jsx';
import SyncPill, { useSyncSummary } from './SyncPill.jsx';
import TenantSwitcher from './TenantSwitcher.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import { cx } from '../../lib/utils.js';

// permission = who may see this item (undefined = everyone)
const NAV = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', key: 'customers', icon: Users },
  { to: '/credits', key: 'credits', icon: HandCoins },
  { to: '/payments', key: 'payments', icon: ReceiptText },
  { to: '/reports', key: 'reports', icon: BarChart3, permission: 'reports.view' },
  { to: '/team', key: 'team', icon: UsersRound, permission: 'team.view' },
  { to: '/plans', key: 'plans', icon: Gem },
  { to: '/settings', key: 'settings', icon: Settings },
];

function useVisibleNav() {
  const role = useAuthStore((s) => s.role);
  const canReports = usePermission('reports.view');
  const canTeam = usePermission('team.view');
  const allowed = { 'reports.view': canReports, 'team.view': canTeam };
  return NAV.filter((n) => !n.permission || allowed[n.permission]).map((n) => ({ ...n, role }));
}

const linkClass = ({ isActive }) => cx(
  'touch flex items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
);

export default function AppShell() {
  const { t, isRtl } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const tenantId = useAuthStore((s) => s.tenantId);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const loading = useDataStore((s) => s.loading);
  const loadError = useDataStore((s) => s.error);
  const load = useDataStore((s) => s.load);
  const openModal = useUiStore((s) => s.openModal);
  const online = useSyncStore((s) => s.browserOnline && !s.simulateOffline);
  const simulated = useSyncStore((s) => s.simulateOffline);
  const { pending } = useSyncSummary();
  const nav = useVisibleNav();
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useConnectivityWatcher(t);

  // (Re)load the active business's data whenever the tenant changes, then flush pending work.
  useEffect(() => {
    if (!tenantId) return;
    load(tenantId).then(() => recoverInterruptedOps().then(() => scheduleSync(600)));
  }, [tenantId, load]);

  // Close sheets when navigating; scroll to top of page.
  useEffect(() => { setMoreOpen(false); setQuickOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const quick = [
    { icon: HandCoins, label: t('quick.newCredit'), sub: t('quick.newCreditSub'), run: () => openModal('credit', {}), tone: 'bg-brand-50 text-brand-600' },
    { icon: Banknote, label: t('quick.takePayment'), sub: t('quick.takePaymentSub'), run: () => openModal('payment', {}), tone: 'bg-accent-50 text-accent-600' },
    { icon: UserPlus, label: t('quick.addCustomer'), sub: '', run: () => openModal('customer', {}), tone: 'bg-mint-50 text-mint-600' },
  ];
  const runQuick = (fn) => { setQuickOpen(false); fn(); };

  // Mobile bottom bar: first two + payments, rest under "More".
  const bottomKeys = ['dashboard', 'customers'];
  const bottomRight = nav.find((n) => n.key === 'payments');
  const bottom = nav.filter((n) => bottomKeys.includes(n.key));
  const moreItems = nav.filter((n) => !bottomKeys.includes(n.key) && n.key !== 'payments');

  return (
    <div className="min-h-dvh bg-ink-50">
      <a href="#main" className="no-print sr-only z-[70] rounded-lg bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:start-3 focus:top-3">{t('nav.skipToContent')}</a>
      <ToastHost />

      {/* ---------- Desktop sidebar ---------- */}
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-ink-200 bg-white p-4 lg:flex">
        <div className="mb-4 flex items-center gap-2.5 px-1">
          <img src="/icons/icon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-extrabold tracking-tight text-ink-900">{t('app.name')}</span>
        </div>
        <TenantSwitcher />
        <nav aria-label="Main" className="mt-5 flex-1 space-y-1 overflow-y-auto">
          {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}><n.icon className="h-5 w-5" aria-hidden />{t(`nav.${n.key}`)}</NavLink>)}
          <NavLink to="/sync" className={linkClass}>
            <RefreshCw className="h-5 w-5" aria-hidden />{t('nav.sync')}
            {pending > 0 && <span className="ms-auto rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-white">{pending}</span>}
          </NavLink>
        </nav>
        <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
          <LanguageSwitcher className="w-full" />
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={user?.name} size="sm" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-ink-500">{t(`roles.${role}`)}</p></div>
            <button onClick={() => setLogoutOpen(true)} aria-label={t('common.logout')} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100"><LogOut className="h-[18px] w-[18px] rtl:-scale-x-100" /></button>
          </div>
        </div>
      </aside>

      <div className="lg:ps-64">
        {/* ---------- Top bar ---------- */}
        <header className="no-print pt-safe sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
              <img src="/icons/icon.svg" alt="" className="h-8 w-8 shrink-0" />
              <span className="truncate text-[15px] font-bold">{useAuthStore.getState().tenant?.name}</span>
            </div>
            <div className="hidden flex-1 gap-2 lg:flex">
              <Button size="sm" variant="accent" icon={Banknote} onClick={() => openModal('payment', {})}>{t('quick.takePayment')}</Button>
              <Button size="sm" variant="secondary" icon={HandCoins} onClick={() => openModal('credit', {})}>{t('quick.newCredit')}</Button>
              <Button size="sm" variant="ghost" icon={UserPlus} onClick={() => openModal('customer', {})}>{t('quick.addCustomer')}</Button>
            </div>
            <SyncPill />
            <LanguageSwitcher compact className="lg:hidden" />
          </div>
          {!online && (
            <div role="status" className="flex items-center justify-center gap-2 bg-ink-800 px-4 py-2 text-center text-sm text-white">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
              <span>{t('sync.offlineBanner')}{simulated && <span className="opacity-70"> {t('sync.simulatedBanner')}</span>}</span>
            </div>
          )}
        </header>

        {/* ---------- Page ---------- */}
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          {loading ? <PageSkeleton /> : loadError ? <ErrorState title={t('errors.LOAD_FAILED')} onRetry={() => load(tenantId)} /> : <Outlet />}
        </main>
      </div>

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav aria-label="Main" className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
          {bottom.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-ink-500')}>
              <n.icon className="h-6 w-6" aria-hidden />{t(`nav.${n.key}`)}
            </NavLink>
          ))}
          <div className="flex h-16 items-start justify-center">
            <button onClick={() => setQuickOpen(true)} aria-label={t('quick.quickActions')} className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-pop active:bg-accent-600">
              <Plus className="h-7 w-7" aria-hidden />
            </button>
          </div>
          {bottomRight && (
            <NavLink to={bottomRight.to} className={({ isActive }) => cx('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-ink-500')}>
              <bottomRight.icon className="h-6 w-6" aria-hidden />{t('nav.payments')}
            </NavLink>
          )}
          <button onClick={() => setMoreOpen(true)} className="relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-ink-500">
            <MoreHorizontal className="h-6 w-6" aria-hidden />{t('nav.more')}
            {pending > 0 && <span className="absolute end-3 top-2 h-2.5 w-2.5 rounded-full bg-accent-500" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Quick actions sheet (phone) */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title={t('quick.quickActions')} size="sm">
        <ul className="space-y-2">
          {quick.map((q) => (
            <li key={q.label}>
              <button onClick={() => runQuick(q.run)} className="touch flex w-full items-center gap-4 rounded-2xl border border-ink-200 p-4 text-start hover:bg-ink-50">
                <span className={cx('flex h-12 w-12 items-center justify-center rounded-xl', q.tone)}><q.icon className="h-6 w-6" aria-hidden /></span>
                <span><span className="block font-bold">{q.label}</span>{q.sub && <span className="block text-sm text-ink-500">{q.sub}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* More sheet (phone) */}
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.menu')} size="sm">
        <TenantSwitcher className="mb-4" />
        <ul className="space-y-1">
          {[...moreItems, { to: '/sync', key: 'sync', icon: RefreshCw }].map((n) => (
            <li key={n.to}><NavLink to={n.to} className={linkClass}><n.icon className="h-5 w-5" aria-hidden />{t(`nav.${n.key}`)}{n.key === 'sync' && pending > 0 && <span className="ms-auto rounded-full bg-accent-500 px-2 py-0.5 text-xs font-bold text-white">{pending}</span>}</NavLink></li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <div className="flex min-w-0 items-center gap-2.5"><Avatar name={user?.name} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="text-xs text-ink-500">{t(`roles.${role}`)}</p></div></div>
          <Button variant="secondary" size="sm" icon={LogOut} onClick={() => { setMoreOpen(false); setLogoutOpen(true); }}>{t('common.logout')}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} title={t('auth.logoutConfirmTitle')} text={t('auth.logoutConfirmText')}
        confirmLabel={t('common.logout')} onConfirm={() => { logout(); navigate('/login'); }} />
      <ModalsHost />
    </div>
  );
}
