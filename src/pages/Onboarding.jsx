// ONBOARDING — create a business in three short steps (business → currency/language → ready).
// Kept deliberately short: a new shopkeeper should reach a working ledger in under a minute.
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ImagePlus, X, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { usePrefsStore } from '../store/prefsStore.js';
import { Field, TextInput, SelectInput, Segmented } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import { Avatar } from '../components/ui/Display.jsx';
import LanguageSwitcher from '../components/layout/LanguageSwitcher.jsx';
import { BUSINESS_TYPES, CURRENCIES, PLANS } from '../config/appConfig.js';
import { useErrorText, useTitle } from '../hooks/useMisc.js';
import { cx } from '../lib/utils.js';

// Downscale an uploaded logo to ≤256px so it stays small in IndexedDB and on printed receipts.
// TODO(backend): upload to storage (S3/local disk) and keep only the URL.
function readLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image'));
      img.onload = () => {
        const scale = Math.min(1, 256 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Reusable logo picker (also used in Settings).
export function LogoPicker({ value, name, onChange, onError }) {
  const { t } = useI18n();
  const input = useRef(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return onError(t('onboarding.logoInvalid'));
    if (file.size > 1024 * 1024) return onError(t('onboarding.logoTooBig'));
    try { onChange(await readLogo(file)); onError(''); } catch { onError(t('onboarding.logoInvalid')); }
  };
  return (
    <div className="flex items-center gap-4">
      {value ? <img src={value} alt="" className="h-16 w-16 rounded-2xl border border-ink-200 object-cover" /> : <Avatar name={name || '?'} size="xl" />}
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={pick} aria-label={t('onboarding.uploadLogo')} />
        <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => input.current.click()}>{t('onboarding.uploadLogo')}</Button>
        {value && <Button variant="ghost" size="sm" icon={X} onClick={() => onChange(null)}>{t('onboarding.removeLogo')}</Button>}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const { t, fmt, lang } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isAdditional = params.get('new') === '1';
  const createBusiness = useAuthStore((s) => s.createBusiness);
  const hasBusiness = useAuthStore((s) => !!s.tenantId);
  const prefs = usePrefsStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', type: 'grocery', currency: 'AFN', phone: '', address: '', logo: null });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  useTitle(t('onboarding.title'));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const steps = ['stepBusiness', 'stepRegion', 'stepReady'];

  const next = () => {
    if (step === 1 && !form.name.trim()) { setErrors({ name: 'required' }); return; }
    setErrors({}); setStep(step + 1);
  };

  const create = async () => {
    setBusy(true); setFormError('');
    try {
      await createBusiness({ ...form, language: lang, dateFormat: prefs.calendar, digits: prefs.digits });
      navigate('/', { replace: true });
    } catch (err) { setFormError(errorText(err)); setBusy(false); }
  };

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-2"><img src="/icons/icon.svg" alt="" className="h-9 w-9" /><span className="font-extrabold">{t('app.name')}</span></div>
        <div className="flex items-center gap-2">
          {(isAdditional || hasBusiness) && <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/')} className="rtl:flex-row-reverse">{t('common.back')}</Button>}
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('onboarding.title')}</h1>
        <p className="mt-1.5 text-ink-500">{t('onboarding.subtitle')}</p>

        <ol className="mt-6 flex gap-2" aria-label={t('onboarding.step', { current: step, total: 3 })}>
          {steps.map((s, i) => (
            <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className="flex-1">
              <div className={cx('h-1.5 rounded-full', step > i ? 'bg-brand-600' : 'bg-ink-200')} />
              <p className={cx('mt-1.5 text-xs font-semibold', step === i + 1 ? 'text-brand-700' : 'text-ink-400')}>{t(`onboarding.${s}`)}</p>
            </li>
          ))}
        </ol>

        <div className="card mt-6 space-y-5 p-5 sm:p-6">
          {step === 1 && (
            <>
              <Field label={t('onboarding.businessName')} error={errors.name && t('validation.required')}>
                {(p) => <TextInput {...p} value={form.name} onChange={set('name')} placeholder={t('onboarding.businessNamePh')} invalid={!!errors.name} autoFocus maxLength={80} />}
              </Field>
              <Field label={t('onboarding.businessType')}>
                {(p) => <SelectInput {...p} value={form.type} onChange={set('type')}>{BUSINESS_TYPES.map((b) => <option key={b} value={b}>{t(`businessTypes.${b}`)}</option>)}</SelectInput>}
              </Field>
              <div>
                <p className="mb-2 text-sm font-medium text-ink-700">{t('onboarding.logo')} <span className="text-xs font-normal text-ink-400">({t('common.optional')})</span></p>
                <LogoPicker value={form.logo} name={form.name} onChange={(logo) => setForm((f) => ({ ...f, logo }))} onError={(m) => setErrors((e) => ({ ...e, logo: m }))} />
                <p className="mt-2 text-sm text-ink-500">{errors.logo ? <span className="text-danger-500">{errors.logo}</span> : t('onboarding.logoHelp')}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('onboarding.phone')} optional optionalText={t('common.optional')}>{(p) => <TextInput {...p} dir="ltr" className="text-start" type="tel" value={form.phone} onChange={set('phone')} />}</Field>
                <Field label={t('onboarding.address')} optional optionalText={t('common.optional')}>{(p) => <TextInput {...p} value={form.address} onChange={set('address')} />}</Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field label={t('onboarding.currency')} hint={t('onboarding.currencyLockedNote')}>
                {(p) => <SelectInput {...p} value={form.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {fmt.currencyName(c.code)}</option>)}</SelectInput>}
              </Field>
              <Field label={t('onboarding.language')}>{() => <div><LanguageSwitcher /></div>}</Field>
              <Field label={t('onboarding.dateFormat')}>
                {() => <div><Segmented label={t('onboarding.dateFormat')} value={prefs.calendar} onChange={prefs.setCalendar} options={[{ value: 'gregorian', label: t('onboarding.calendarGregorian') }, { value: 'solar', label: t('onboarding.calendarSolar') }]} /></div>}
              </Field>
              <Field label={t('onboarding.digits')}>
                {() => <div><Segmented label={t('onboarding.digits')} value={prefs.digits} onChange={prefs.setDigits} options={[{ value: 'latn', label: t('onboarding.digitsLatin') }, { value: 'native', label: t('onboarding.digitsNative') }]} /></div>}
              </Field>
              <p className="rounded-xl bg-ink-50 p-3 text-sm text-ink-600">{fmt.date(new Date().toISOString().slice(0, 10), 'long')} · <bdi>{fmt.money(125000, form.currency)}</bdi></p>
            </>
          )}

          {step === 3 && (
            <div className="py-4 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint-100 text-mint-700"><Check className="h-8 w-8" aria-hidden /></span>
              <h2 className="mt-4 text-2xl font-extrabold">{t('onboarding.readyTitle')}</h2>
              <p className="mx-auto mt-2 max-w-sm text-ink-600">{t('onboarding.readyText', { customers: fmt.number(PLANS.free.limits.customers) })}</p>
              <div className="mx-auto mt-5 flex max-w-xs items-center gap-3 rounded-2xl border border-ink-200 p-3 text-start">
                {form.logo ? <img src={form.logo} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <Avatar name={form.name} />}
                <div className="min-w-0"><p className="truncate font-bold">{form.name}</p><p className="text-sm text-ink-500">{t(`businessTypes.${form.type}`)} · {form.currency}</p></div>
              </div>
              <p className="mt-4 text-sm text-ink-500">{t('onboarding.sampleNote')}</p>
              {formError && <p role="alert" className="mt-4 rounded-xl bg-danger-50 p-3 text-sm text-danger-600">{formError}</p>}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-between gap-3">
          {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>{t('common.back')}</Button> : <span />}
          {step < 3 ? <Button onClick={next}>{t('common.next')}</Button> : <Button variant="accent" size="lg" loading={busy} onClick={create}>{busy ? t('onboarding.creating') : t('onboarding.create')}</Button>}
        </div>
      </main>
    </div>
  );
}
