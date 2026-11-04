// ROUTES + ACCESS GUARDS
// Three layers: public (login/register) → signed-in (onboarding) → inside a business (AppShell).
// Role guards here only hide pages from the UI; the backend must authorize each API call.
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { usePermission } from './hooks/useMisc.js';
import { useI18n } from './i18n/useI18n.js';
import AppShell from './components/layout/AppShell.jsx';
import { PageSkeleton, EmptyState } from './components/ui/Display.jsx';
import { Lock, Compass } from 'lucide-react';
import Button from './components/ui/Button.jsx';
import { Link } from 'react-router-dom';
import ToastHost from './components/ui/Toasts.jsx';

// Code-splitting: pages load on demand (and are all precached by the service worker for offline use).
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail.jsx'));
const Statement = lazy(() => import('./pages/Statement.jsx'));
const Credits = lazy(() => import('./pages/Credits.jsx'));
const Payments = lazy(() => import('./pages/Payments.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Team = lazy(() => import('./pages/Team.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Plans = lazy(() => import('./pages/Plans.jsx'));
const SyncCenter = lazy(() => import('./pages/SyncCenter.jsx'));

function BootScreen() {
  const { t } = useI18n();
  return <div role="status" className="flex min-h-dvh items-center justify-center text-ink-500">{t('boot.loading')}</div>;
}

function RequireAuth({ children, needTenant = true }) {
  const { ready, user, tenantId } = useAuthStore();
  const location = useLocation();
  if (!ready) return <BootScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (needTenant && !tenantId) return <Navigate to="/onboarding" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { ready, user, tenantId } = useAuthStore();
  if (!ready) return <BootScreen />;
  if (user) return <Navigate to={tenantId ? '/' : '/onboarding'} replace />;
  return children;
}

function RequirePermission({ permission, children }) {
  const { t } = useI18n();
  const allowed = usePermission(permission);
  if (allowed) return children;
  return (
    <EmptyState icon={Lock} title={t('noAccess.title')} text={t('noAccess.text')}
      action={<Link to="/"><Button variant="secondary">{t('notFound.home')}</Button></Link>} />
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <EmptyState icon={Compass} title={t('notFound.title')} text={t('notFound.text')}
      action={<Link to="/"><Button>{t('notFound.home')}</Button></Link>} />
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><PageSkeleton /></div>}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/onboarding" element={<RequireAuth needTenant={false}><ToastHost /><Onboarding /></RequireAuth>} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="customers/:id/statement" element={<Statement />} />
          <Route path="credits" element={<Credits />} />
          <Route path="payments" element={<Payments />} />
          <Route path="reports" element={<RequirePermission permission="reports.view"><Reports /></RequirePermission>} />
          <Route path="team" element={<RequirePermission permission="team.view"><Team /></RequirePermission>} />
          <Route path="plans" element={<Plans />} />
          <Route path="settings" element={<Settings />} />
          <Route path="sync" element={<SyncCenter />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
