// useI18n — the one hook components use for text and formatting.
//   const { t, fmt, isRtl } = useI18n();
//   t('customers.title')                    -> translated string
//   t('sync.toast.synced', { count: 3 })    -> "{count}" placeholders are replaced
//   fmt.money(12500)                        -> amount in the active business currency
//
// Lookup order: active language -> English -> the key itself (so a missing translation is
// visible but never crashes). `npm run check:i18n` finds missing keys before release.

import { useMemo } from 'react';
import { usePrefsStore } from '../store/prefsStore.js';
import { useAuthStore } from '../store/authStore.js';
import { DICTIONARIES, LOCALES } from './locales/index.js';
import { getCurrency } from '../config/appConfig.js';
import * as f from './format.js';

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(lang, key, params) {
  let text = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.en, key) ?? key;
  if (params) text = text.replace(/\{(\w+)\}/g, (m, name) => (params[name] !== undefined ? params[name] : m));
  return text;
}

export function useI18n() {
  const lang = usePrefsStore((s) => s.language);
  const calendar = usePrefsStore((s) => s.calendar);
  const digits = usePrefsStore((s) => s.digits);
  const currency = useAuthStore((s) => s.tenant?.currency || 'USD');

  return useMemo(() => {
    const prefs = { lang, calendar, digits };
    const meta = LOCALES[lang];
    return {
      lang, calendar, digits, currency,
      dir: meta.dir,
      isRtl: meta.dir === 'rtl',
      decimals: getCurrency(currency).decimals,
      t: (key, params) => translate(lang, key, params),
      fmt: {
        number: (n, o) => f.formatNumber(n, prefs, o),
        money: (minor, code = currency) => f.formatMoney(minor, code, prefs),
        compact: (n) => f.formatCompact(n, prefs),
        date: (iso, style) => f.formatDate(iso, prefs, style),
        dateTime: (ts) => f.formatDateTime(ts, prefs),
        month: (key, style) => f.formatMonth(key, prefs, style),
        percent: (n) => f.formatPercent(n, prefs),
        currencyName: (code) => f.currencyName(code, lang),
      },
    };
  }, [lang, calendar, digits, currency]);
}
