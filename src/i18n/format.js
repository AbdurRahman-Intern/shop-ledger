// LOCALIZED FORMATTING (numbers, money, dates)
// Built on the browser's Intl API, which works offline and knows every script/calendar we need.
//
// Two user preferences change the output:
//   digits   'latn' -> 1,250   |  'native' -> ١٬٢٥٠ (Arabic) / ۱٬۲۵۰ (Dari, Pashto)
//   calendar 'gregorian'       |  'solar' (Solar Hijri, official in Afghanistan)
// Stored dates are ALWAYS Gregorian ISO strings; the calendar only changes how they are shown.
//
// Formatters are expensive to construct, so we cache one per (locale tag + options).

import { LOCALES } from './locales/index.js';
import { getCurrency } from '../config/appConfig.js';
import { fromISODate } from '../lib/dates.js';

const cache = new Map();
function formatter(Ctor, tag, options) {
  const key = Ctor.name + tag + JSON.stringify(options);
  if (!cache.has(key)) {
    try {
      cache.set(key, new Ctor(tag, options));
    } catch {
      // A tag the browser does not know (rare): fall back to the base language.
      cache.set(key, new Ctor(tag.split('-')[0], options));
    }
  }
  return cache.get(key);
}

// Build a locale tag such as "fa-AF-u-ca-persian-nu-arabext" (extension keys sorted: ca, nu).
const supportCache = new Map();
function isSupported(tag) {
  const base = tag.split('-')[0];
  if (!supportCache.has(base)) supportCache.set(base, Intl.NumberFormat.supportedLocalesOf([base]).length > 0 && Intl.DateTimeFormat.supportedLocalesOf([base]).length > 0);
  return supportCache.get(base);
}

export function localeTag(lang, { digits = 'latn', calendar = 'gregorian' } = {}) {
  const meta0 = LOCALES[lang] || LOCALES.en;
  // Use the browser's data for this language if it has it, otherwise the declared fallback.
  const meta = { ...meta0, intl: isSupported(meta0.intl) ? meta0.intl : (meta0.fallbackIntl || 'en-US') };
  const nu = digits === 'native' ? meta.nativeDigits : 'latn';
  const ca = calendar === 'solar' ? 'persian' : 'gregory';
  return `${meta.intl}-u-ca-${ca}-nu-${nu}`;
}

export function formatNumber(value, prefs, options = {}) {
  return formatter(Intl.NumberFormat, localeTag(prefs.lang, { digits: prefs.digits }), options).format(value);
}

// Money: amount is in MINOR units, e.g. 125050 with USD -> "$1,250.50".
export function formatMoney(minor, currencyCode, prefs) {
  const { decimals } = getCurrency(currencyCode);
  const tag = localeTag(prefs.lang, { digits: prefs.digits });
  return formatter(Intl.NumberFormat, tag, {
    style: 'currency', currency: currencyCode,
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(minor / 10 ** decimals);
}

// Compact number for chart axes: 12K, 1.2M (locale aware).
export function formatCompact(value, prefs) {
  return formatter(Intl.NumberFormat, localeTag(prefs.lang, { digits: prefs.digits }), { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

const DATE_STYLES = {
  short: { day: 'numeric', month: 'short' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
};


// ---------- Pashto date formatting (hand-built; see note in locales/index.js) ----------
const PS_GREG_MONTHS = ['جنوري', 'فبروري', 'مارچ', 'اپرېل', 'می', 'جون', 'جولای', 'اګست', 'سپتمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
// Afghan Solar Hijri month names in Pashto (Hamal … Hoot).
const PS_SOLAR_MONTHS = ['وری', 'غويی', 'غبرګولی', 'چنګاښ', 'زمری', 'وږی', 'تله', 'لړم', 'ليندۍ', 'مرغومی', 'سلواغه', 'كب'];
const PS_WEEKDAYS = ['اتوار', 'دوشنبه', 'درېشنبه', 'څلورشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const ARABEXT = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const toDigits = (value, prefs) => (prefs.digits === 'native' ? String(value).replace(/\d/g, (d) => ARABEXT[d]) : String(value));

// Solar Hijri y/m/d for a JS date. The English locale supports the Persian calendar everywhere.
function solarParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date).map((p) => [p.type, p.value]));
  return { y: Number(parts.relatedYear || parts.year), m: Number(parts.month), d: Number(parts.day) };
}

function formatDatePs(date, prefs, style) {
  const solar = prefs.calendar === 'solar';
  const { y, m, d } = solar ? solarParts(date) : { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
  const names = solar ? PS_SOLAR_MONTHS : PS_GREG_MONTHS;
  if (style === 'numeric') return toDigits(`${d}/${m}/${y}`, prefs);
  if (style === 'short') return `${toDigits(d, prefs)} ${names[m - 1]}`;
  const core = `${toDigits(d, prefs)} ${names[m - 1]} ${toDigits(y, prefs)}`;
  return style === 'long' ? `${PS_WEEKDAYS[date.getDay()]}، ${core}` : core;
}

// `iso` is a business date ('YYYY-MM-DD').
export function formatDate(iso, prefs, style = 'medium') {
  if (!iso) return '';
  const date = fromISODate(iso);
  if (prefs.lang === 'ps') return formatDatePs(date, prefs, style);
  const tag = localeTag(prefs.lang, { digits: prefs.digits, calendar: prefs.calendar });
  return formatter(Intl.DateTimeFormat, tag, DATE_STYLES[style]).format(date);
}

// `timestamp` is a full ISO timestamp (createdAt). Shown in the device's time zone.
export function formatDateTime(timestamp, prefs) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const tag = localeTag(prefs.lang, { digits: prefs.digits });
  const time = formatter(Intl.DateTimeFormat, tag, { hour: '2-digit', minute: '2-digit' }).format(d);
  return `${formatDate(iso, prefs, 'medium')} · ${time}`;
}

// Month buckets in reports are GREGORIAN months, so their labels are always Gregorian
// (labelling them with Solar Hijri month names would be misleading).
// TODO(improvement): calendar-aware month grouping for Solar Hijri reports.
export function formatMonth(monthKey, prefs, style = 'short') {
  if (prefs.lang === 'ps') {
    const [y, m] = monthKey.split('-').map(Number);
    return `${PS_GREG_MONTHS[m - 1]} ${toDigits(y, prefs)}`;
  }
  const tag = localeTag(prefs.lang, { digits: prefs.digits, calendar: 'gregorian' });
  const options = style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short', year: 'numeric' };
  return formatter(Intl.DateTimeFormat, tag, options).format(fromISODate(`${monthKey}-15`));
}

export function formatPercent(value, prefs) {
  return formatter(Intl.NumberFormat, localeTag(prefs.lang, { digits: prefs.digits }), { style: 'percent', maximumFractionDigits: 0 }).format(value);
}

// Localized currency name ("Afghan Afghani" / "افغانی") straight from the browser.
export function currencyName(code, lang) {
  try {
    return new Intl.DisplayNames([LOCALES[lang]?.intl || 'en'], { type: 'currency' }).of(code);
  } catch {
    return code;
  }
}
