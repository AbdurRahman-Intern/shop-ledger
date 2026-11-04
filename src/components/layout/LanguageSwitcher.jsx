// LANGUAGE SWITCHER — a native <select> (accessible everywhere, great on phones).
// Changing it updates <html lang dir> immediately via the prefs store, which flips the whole
// layout between LTR and RTL with no reload.
import { Globe } from 'lucide-react';
import { usePrefsStore } from '../../store/prefsStore.js';
import { LOCALES, LANGUAGE_CODES } from '../../i18n/locales/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { cx } from '../../lib/utils.js';

export default function LanguageSwitcher({ className, compact = false }) {
  const { t, lang } = useI18n();
  const setLanguage = usePrefsStore((s) => s.setLanguage);
  return (
    <label className={cx('relative inline-flex items-center', className)}>
      <span className="sr-only">{t('common.language')}</span>
      <Globe className="pointer-events-none absolute start-3 h-4 w-4 text-ink-500" aria-hidden />
      <select value={lang} onChange={(e) => setLanguage(e.target.value)}
        className={cx('touch h-10 cursor-pointer appearance-none rounded-xl border border-ink-300 bg-white ps-9 text-sm font-medium text-ink-800 hover:bg-ink-50', compact ? 'pe-3' : 'pe-4')}>
        {LANGUAGE_CODES.map((code) => <option key={code} value={code}>{LOCALES[code].native}</option>)}
      </select>
    </label>
  );
}
