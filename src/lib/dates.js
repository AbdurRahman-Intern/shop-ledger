// DATE HELPERS
// Business dates (the day a sale happened) are stored as plain 'YYYY-MM-DD' strings in
// the shop's local calendar — NOT as timestamps. A timestamp would shift the day when a
// device changes time zone and would break "what did we collect on Tuesday?" reports.
// Exact moments (createdAt) are stored separately as ISO timestamps.
// Dates are always stored in the Gregorian calendar; the Solar Hijri calendar used in
// Afghanistan is a *display* option handled in src/i18n/format.js.

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

// Parse at local noon so daylight-saving shifts can never move us to another day.
export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDays(iso, n) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((fromISODate(toIso) - fromISODate(fromIso)) / 86400000);
}

export const monthKey = (iso) => iso.slice(0, 7); // 'YYYY-MM'

export function startOfMonth(iso) {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(monthKeyStr, n) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function endOfMonth(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return toISODate(new Date(y, m, 0, 12));
}

// Inclusive list of ISO dates between two dates.
export function eachDay(fromIso, toIso) {
  const out = [];
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) out.push(d);
  return out;
}
