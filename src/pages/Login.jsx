// LOGIN — with one-tap demo accounts so a shop owner (or investor) can explore every role.
// SECURITY: mock auth only (see authService). TODO(backend): Sanctum login.
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, WifiOff, FileCheck2, Languages, UserRound } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { Field, TextInput } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import LanguageSwitcher from '../components/layout/LanguageSwitcher.jsx';
import ToastHost from '../components/ui/Toasts.jsx';
import { validateEmail, validatePassword } from '../lib/validation.js';
import { useErrorText, useTitle } from '../hooks/useMisc.js';
import { APP } from '../config/appConfig.js';

const DEMOS = [
  { email: 'owner@alnoor.demo', key: 'demoOwner' },
  { email: 'manager@alnoor.demo', key: 'demoManager' },
  { email: 'employee@alnoor.demo', key: 'demoEmployee' },
  { email: 'sara@bright.demo', key: 'demoSara' },
];

// Shared left/right split used by Login and Register.
export function AuthLayout({ children }) {
  const { t } = useI18n();
  const feats = [[WifiOff, 'feat1'], [FileCheck2, 'feat2'], [Languages, 'feat3']];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <ToastHost />
      <aside className="relative hidden flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3"><img src="/icons/icon.svg" alt="" className="h-11 w-11" /><span className="text-xl font-extrabold">{t('app.name')}</span></div>
        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">{t('auth.heroTitle')}</h2>
          <p className="mt-4 max-w-md text-lg text-brand-100">{t('auth.heroText')}</p>
          <ul className="mt-8 space-y-3">
            {feats.map(([Icon, k]) => (
              <li key={k} className="flex items-center gap-3 text-brand-50"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>{t(`auth.${k}`)}</li>
            ))}
          </ul>
        </div>
        {/* Illustrative receipt card: shows the product promise (clear, trusted records). */}
        <div className="max-w-xs rounded-2xl bg-white p-4 text-ink-900 shadow-pop" aria-hidden>
          <div className="flex items-center justify-between text-sm"><span className="font-semibold">R-00128</span><span className="rounded-full bg-mint-100 px-2 py-0.5 text-xs font-bold text-mint-700">{t('status.paid')}</span></div>
          <div className="mt-2 text-2xl font-extrabold text-mint-700"><bdi>2,500 AFN</bdi></div>
          <div className="mt-1 h-2 w-full rounded-full bg-ink-100"><div className="h-2 w-4/5 rounded-full bg-mint-500" /></div>
        </div>
      </aside>
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible"><img src="/icons/icon.svg" alt="" className="h-9 w-9" /><span className="font-extrabold">{t('app.name')}</span></div>
          <LanguageSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">{children}</div>
      </main>
    </div>
  );
}

export default function Login() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  useTitle(t('auth.login'));

  const submit = async (e) => {
    e.preventDefault();
    const errs = { email: validateEmail(email), password: validatePassword(password) };
    Object.keys(errs).forEach((k) => !errs[k] && delete errs[k]);
    setErrors(errs); setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const { hasBusiness } = await login(email, password);
      navigate(hasBusiness ? (location.state?.from || '/') : '/onboarding', { replace: true });
    } catch (err) { setFormError(errorText(err)); setBusy(false); }
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.welcomeBack')}</h1>
      <p className="mt-1.5 text-ink-500">{t('auth.loginSubtitle')}</p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Field label={t('auth.email')} error={errors.email && t(`validation.${errors.email}`)}>
          {(p) => <TextInput {...p} type="email" dir="ltr" className="text-start" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />}
        </Field>
        <Field label={t('auth.password')} error={errors.password && t(`validation.${errors.password}`)}>
          {(p) => (
            <div className="relative">
              <TextInput {...p} type={show ? 'text' : 'password'} dir="ltr" className="pe-12 text-start" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!errors.password} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')} className="absolute inset-y-0 end-1 flex w-11 items-center justify-center text-ink-500">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          )}
        </Field>
        {formError && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm text-danger-600">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{busy ? t('auth.signingIn') : t('auth.login')}</Button>
      </form>
      <p className="mt-5 text-center text-ink-600">{t('auth.noAccount')} <Link to="/register" className="font-semibold text-brand-700 hover:underline">{t('auth.register')}</Link></p>

      <section className="mt-8 rounded-2xl border border-ink-200 bg-white p-4" aria-labelledby="demo-h">
        <h2 id="demo-h" className="text-sm font-bold">{t('auth.demoTitle')}</h2>
        <p className="mt-0.5 text-xs text-ink-500">{t('auth.demoHint', { password: APP.demoPassword })}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DEMOS.map((d) => (
            <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword(APP.demoPassword); setErrors({}); setFormError(''); }}
              className="touch flex items-center gap-2 rounded-xl border border-ink-200 px-3 text-start text-sm font-medium hover:border-brand-300 hover:bg-brand-50">
              <UserRound className="h-4 w-4 shrink-0 text-brand-600" aria-hidden /><span className="truncate">{t(`auth.${d.key}`)}</span>
            </button>
          ))}
        </div>
      </section>
    </AuthLayout>
  );
}
