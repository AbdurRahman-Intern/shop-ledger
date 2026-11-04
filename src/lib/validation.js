// VALIDATION
// Returns error *codes* (not English text). Components translate them with
// t(`validation.${code}`) so messages appear in the user's language.
// TODO(backend): Laravel Form Requests must repeat every rule — never trust the client.

import { parseAmount } from './finance.js';
import { todayISO } from './dates.js';

const PHONE_RE = /^[+\d][\d\s\-()]{5,19}$/;

export function validateCustomer({ name, phone }) {
  const errors = {};
  if (!name || !name.trim()) errors.name = 'required';
  else if (name.trim().length > 80) errors.name = 'tooLong';
  // Phone is optional (some customers are only known by name) but must look right if given.
  if (phone && phone.trim() && !PHONE_RE.test(phone.trim())) errors.phone = 'invalidPhone';
  return errors;
}

// `max` (minor units) is used for payments: you cannot collect more than is owed.
export function validateAmount(text, decimals, { max = null } = {}) {
  const minor = parseAmount(text, decimals);
  if (text == null || String(text).trim() === '') return { error: 'required' };
  if (minor === null) return { error: decimals === 0 ? 'invalidWholeAmount' : 'invalidAmount' };
  if (minor <= 0) return { error: 'amountPositive' };
  if (max !== null && minor > max) return { error: 'amountExceedsBalance' };
  return { minor };
}

export function validateDate(iso) {
  if (!iso) return 'required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'invalidDate';
  if (iso > todayISO()) return 'dateInFuture'; // future-dated ledger entries would corrupt "today" reports
  return null;
}

export function validateEmail(email) {
  if (!email || !email.trim()) return 'required';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'invalidEmail';
}

export function validatePassword(pw) {
  if (!pw) return 'required';
  return pw.length >= 6 ? null : 'passwordShort';
}
