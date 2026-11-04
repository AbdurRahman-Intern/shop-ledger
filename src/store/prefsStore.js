// PREFERENCES STORE — language, calendar and digit style for THIS device/user.
//
// RTL IMPLEMENTATION (the key idea): we set `dir` and `lang` on <html>. Tailwind's logical
// utilities (ms-*, ps-*, text-start, border-s...) and flexbox then flip automatically, so
// components never need `if (isRtl)` checks. The few direction-sensitive icons use the
// `rtl:` variant. Preferences are read synchronously from localStorage BEFORE first paint
// (see applyDocumentLanguage in main.jsx) to avoid a flash of the wrong direction.

import { create } from 'zustand';
import { STORAGE_KEYS } from '../config/appConfig.js';
import { LOCALES, DEFAULT_LANGUAGE } from '../i18n/locales/index.js';

const RTL_DEFAULTS = (lang) => ({
  // Afghan users overwhelmingly use the Solar Hijri calendar in Dari/Pashto; offered as default there.
  calendar: lang === 'prs' || lang === 'ps' ? 'solar' : 'gregorian',
  digits: LOCALES[lang].dir === 'rtl' ? 'native' : 'latn',
});

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.prefs) || 'null');
    if (saved && LOCALES[saved.language]) return saved;
  } catch { /* corrupted or unavailable storage: fall through to defaults */ }
  return { language: DEFAULT_LANGUAGE, ...RTL_DEFAULTS(DEFAULT_LANGUAGE), calendarExplicit: false, digitsExplicit: false };
}

function persist(prefs) {
  try { localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs)); } catch { /* ignore */ }
}

export function applyDocumentLanguage(lang) {
  const meta = LOCALES[lang] || LOCALES[DEFAULT_LANGUAGE];
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dir = meta.dir;
  document.documentElement.dataset.lang = lang; // CSS hook for per-script typography
}

export const usePrefsStore = create((set, get) => ({
  ...read(),

  setLanguage: (language) => {
    const cur = get();
    const defaults = RTL_DEFAULTS(language);
    const next = {
      language,
      calendar: cur.calendarExplicit ? cur.calendar : defaults.calendar,
      digits: cur.digitsExplicit ? cur.digits : defaults.digits,
      calendarExplicit: cur.calendarExplicit,
      digitsExplicit: cur.digitsExplicit,
    };
    applyDocumentLanguage(language);
    persist(next);
    set(next);
  },
  setCalendar: (calendar) => {
    const next = { ...get(), calendar, calendarExplicit: true };
    persist(pick(next)); set({ calendar, calendarExplicit: true });
  },
  setDigits: (digits) => {
    const next = { ...get(), digits, digitsExplicit: true };
    persist(pick(next)); set({ digits, digitsExplicit: true });
  },
}));

const pick = ({ language, calendar, digits, calendarExplicit, digitsExplicit }) => ({ language, calendar, digits, calendarExplicit, digitsExplicit });
