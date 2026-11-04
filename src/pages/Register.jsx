// REGISTER — creates a user account; the business itself is created in Onboarding.
// TODO(backend): POST /api/auth/register, e-mail verification.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { Field, TextInput } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import { AuthLayout } from './Login.jsx';
import { validateEmail, validatePassword } from '../lib/validation.js';
import { useErrorText, useTitle } from '../hooks/useMisc.js';

export default function Register() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  useTitle(t('auth.register'));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = { name: form.name.trim() ? null : 'required', email: validateEmail(form.email), password: validatePassword(form.password) };
    Object.keys(errs).forEach((k) => !errs[k] && delete errs[k]);
    setErrors(errs); setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await register(form); navigate('/onboarding', { replace: true }); }
    catch (err) { setFormError(errorText(err)); setBusy(false); }
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-extrabold tracking-tight">{t('auth.createAccount')}</h1>
      <p className="mt-1.5 text-ink-500">{t('auth.registerSubtitle')}</p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Field label={t('auth.fullName')} error={errors.name && t(`validation.${errors.name}`)}>
          {(p) => <TextInput {...p} autoComplete="name" value={form.name} onChange={set('name')} invalid={!!errors.name} />}
        </Field>
        <Field label={t('auth.email')} error={errors.email && t(`validation.${errors.email}`)}>
          {(p) => <TextInput {...p} type="email" dir="ltr" className="text-start" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />}
        </Field>
        <Field label={t('auth.password')} error={errors.password && t(`validation.${errors.password}`)}>
          {(p) => <TextInput {...p} type="password" dir="ltr" className="text-start" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!errors.password} />}
        </Field>
        {formError && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm text-danger-600">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>{t('auth.register')}</Button>
      </form>
      <p className="mt-5 text-center text-ink-600">{t('auth.haveAccount')} <Link to="/login" className="font-semibold text-brand-700 hover:underline">{t('auth.login')}</Link></p>
    </AuthLayout>
  );
}
