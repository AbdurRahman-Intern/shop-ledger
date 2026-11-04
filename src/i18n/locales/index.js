// LOCALE REGISTRY
// To add a language: (1) create src/i18n/locales/<code>.js exporting a dictionary shaped
// like en.js, (2) register it below. `npm run check:i18n` reports any missing keys.
//
//  code   : key used in the app and saved in preferences
//  htmlLang: value for <html lang> (affects screen readers and font selection)
//  intl   : BCP-47 tag passed to Intl.* for dates/numbers
//  dir    : text direction
//  nativeDigits: Unicode numbering system used when the "native digits" preference is on

import en from './en.js';
import ar from './ar.js';
import prs from './prs.js';
import ps from './ps.js';

export const LOCALES = {
  en: { code: 'en', htmlLang: 'en', intl: 'en-US', dir: 'ltr', native: 'English', nativeDigits: 'latn' },
  ar: { code: 'ar', htmlLang: 'ar', intl: 'ar', dir: 'rtl', native: 'العربية', nativeDigits: 'arab' },
  // Dari (Afghan Persian) has no ISO 639-1 code; we use its ISO 639-3 code "prs".
  prs: { code: 'prs', htmlLang: 'fa-AF', intl: 'fa-AF', dir: 'rtl', native: 'دری', nativeDigits: 'arabext' },
  // Pashto: not every browser ships ICU data for it, so numbers fall back to Persian (same digits/separators)
  // and dates are built by hand in src/i18n/format.js.
  ps: { code: 'ps', htmlLang: 'ps', intl: 'ps-AF', fallbackIntl: 'fa-AF', dir: 'rtl', native: 'پښتو', nativeDigits: 'arabext' },
};

export const DICTIONARIES = { en, ar, prs, ps };
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_CODES = Object.keys(LOCALES);
