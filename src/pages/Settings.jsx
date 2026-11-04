// SETTINGS — business info (owner only), personal preferences (everyone), notifications, install, demo data.
// "Preferences" (language, calendar, digits) are per DEVICE/user, so every role can change them.
// Business settings change data shared by the whole team, so only owners can edit them.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RotateCcw, ShieldAlert, Check } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { usePrefsStore } from '../store/prefsStore.js';
import { useDataStore } from '../store/dataStore.js';
import { useUiStore } from '../store/uiStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { usePermission, useTitle, useInstallPrompt, useErrorText } from '../hooks/useMisc.js';
import { Card, CardHeader, PageHeader } from '../components/ui/Display.jsx';
import { Field, TextInput, SelectInput, Segmented, Switch } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import LanguageSwitcher from '../components/layout/LanguageSwitcher.jsx';
import { LogoPicker } from './Onboarding.jsx';
import { BUSINESS_TYPES, CURRENCIES } from '../config/appConfig.js';
import { seedDemoData } from '../mock/seed.js';
import { todayISO } from '../lib/dates.js';

export default function Settings() {
  const { t, fmt, lang } = useI18n();
  useTitle(t('nav.settings'));
  const navigate = useNavigate();
  const errorText = useErrorText();
  const toast = useUiStore((s) => s.toast);
  const tenant = useAuthStore((s) => s.tenant);
  const updateBusiness = useAuthStore((s) => s.updateBusiness);
  const logout = useAuthStore((s) => s.logout);
  const prefs = usePrefsStore();
  const canManage = usePermission('settings.manage');
  const { data } = useLedger();
  const { canInstall, installed, install } = useInstallPrompt();
  const [form, setForm] = useState(null);
  const [logoError, setLogoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => { setForm({ name: tenant.name, type: tenant.type, phone: tenant.phone || '', address: tenant.address || '', logo: tenant.logo, currency: tenant.currency, overdueDays: String(tenant.overdueDays) }); }, [tenant]);
  if (!form) return null;

  // Currency is stored in the currency's minor units, so it cannot change once records exist.
  const hasRecords = data.credits.length + data.payments.length > 0;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = form.name !== tenant.name || form.type !== tenant.type || form.phone !== (tenant.phone || '') || form.address !== (tenant.address || '') || form.logo !== tenant.logo || form.currency !== tenant.currency || Number(form.overdueDays) !== tenant.overdueDays;

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('error', t('validation.required'));
    const days = Math.min(365, Math.max(1, parseInt(form.overdueDays, 10) || 30));
    setBusy(true);
    try { await updateBusiness({ name: form.name.trim(), type: form.type, phone: form.phone, address: form.address, logo: form.logo, currency: form.currency, overdueDays: days }); toast('success', t('settings.saved')); }
    catch (err) { toast('error', errorText(err)); } finally { setBusy(false); }
  };

  const setNotif = async (key, value) => {
    try { await updateBusiness({ notifications: { ...tenant.notifications, [key]: value } }); } catch (err) { toast('error', errorText(err)); }
  };

  const reset = async () => {
    await seedDemoData();
    logout();
    toast('success', t('settings.resetDone'));
    navigate('/login', { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Card>
        <CardHeader title={t('settings.businessInfo')} subtitle={!canManage ? t('settings.ownerOnly') : t('settings.multiTenantNote')} />
        <form onSubmit={save} className="space-y-4 p-5" noValidate>
          <fieldset disabled={!canManage} className="space-y-4 disabled:opacity-70">
            <div><p className="mb-2 text-sm font-medium text-ink-700">{t('settings.logo')}</p><LogoPicker value={form.logo} name={form.name} onChange={(logo) => setForm((f) => ({ ...f, logo }))} onError={setLogoError} />{logoError && <p className="mt-2 text-sm text-danger-500">{logoError}</p>}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onboarding.businessName')}>{(p) => <TextInput {...p} value={form.name} onChange={set('name')} maxLength={80} />}</Field>
              <Field label={t('onboarding.businessType')}>{(p) => <SelectInput {...p} value={form.type} onChange={set('type')}>{BUSINESS_TYPES.map((b) => <option key={b} value={b}>{t(`businessTypes.${b}`)}</option>)}</SelectInput>}</Field>
              <Field label={t('onboarding.phone')}>{(p) => <TextInput {...p} dir="ltr" className="text-start" value={form.phone} onChange={set('phone')} />}</Field>
              <Field label={t('onboarding.address')}>{(p) => <TextInput {...p} value={form.address} onChange={set('address')} />}</Field>
              <Field label={t('settings.currency')} hint={hasRecords ? t('settings.currencyLocked') : undefined}>
                {(p) => <SelectInput {...p} value={form.currency} onChange={set('currency')} disabled={hasRecords}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {fmt.currencyName(c.code)}</option>)}</SelectInput>}
              </Field>
              <Field label={t('settings.overdueDays')} hint={t('settings.overdueHelp')}>{(p) => <TextInput {...p} inputMode="numeric" value={form.overdueDays} onChange={set('overdueDays')} />}</Field>
            </div>
          </fieldset>
          {canManage && <div className="flex justify-end"><Button type="submit" loading={busy} disabled={!dirty} icon={Check}>{t('common.save')}</Button></div>}
        </form>
      </Card>

      <Card>
        <CardHeader title={t('settings.preferences')} />
        <div className="space-y-5 p-5">
          <Field label={t('settings.appLanguage')}>{() => <div><LanguageSwitcher /></div>}</Field>
          <Field label={t('settings.calendar')}>{() => <div><Segmented label={t('settings.calendar')} value={prefs.calendar} onChange={prefs.setCalendar} options={[{ value: 'gregorian', label: t('onboarding.calendarGregorian') }, { value: 'solar', label: t('onboarding.calendarSolar') }]} /></div>}</Field>
          <Field label={t('settings.digits')}>{() => <div><Segmented label={t('settings.digits')} value={prefs.digits} onChange={prefs.setDigits} options={[{ value: 'latn', label: t('onboarding.digitsLatin') }, { value: 'native', label: t('onboarding.digitsNative') }]} /></div>}</Field>
          <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-700"><span className="font-semibold">{t('settings.preview')}:</span> {fmt.date(todayISO(), 'long')} · <bdi>{fmt.money(1250050)}</bdi></p>
        </div>
      </Card>

      <Card>
        <CardHeader title={t('settings.notifications')} subtitle={t('settings.notif.todo')} />
        <div className="divide-y divide-ink-100 px-5 pb-2">
          {['overdueReminders', 'dailySummary', 'syncAlerts'].map((k) => (
            <Switch key={k} label={t(`settings.notif.${k}`)} description={t(`settings.notif.${k}Help`)} checked={!!tenant.notifications?.[k]} disabled={!canManage} onChange={(v) => setNotif(k, v)} />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('settings.install')} subtitle={t('settings.installHelp')} />
        <div className="p-5">{installed ? <p className="font-medium text-mint-700">✓ {t('settings.installed')}</p> : canInstall ? <Button icon={Download} onClick={install}>{t('settings.installButton')}</Button> : <p className="text-sm text-ink-500">{t('settings.installUnavailable')}</p>}</div>
      </Card>

      <Card className="border-accent-200">
        <CardHeader title={t('settings.backendTitle')} />
        <p className="flex items-start gap-3 p-5 text-sm text-ink-600"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden />{t('settings.backendNote')}</p>
      </Card>

      <Card>
        <CardHeader title={t('settings.data')} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="max-w-md text-sm text-ink-600">{t('settings.resetDemoHelp')}</p><Button variant="secondary" icon={RotateCcw} onClick={() => setResetOpen(true)}>{t('settings.resetDemo')}</Button></div>
      </Card>

      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={reset} danger title={t('settings.resetConfirmTitle')} text={t('settings.resetConfirmText')} confirmLabel={t('settings.resetDemo')} />
    </div>
  );
}
