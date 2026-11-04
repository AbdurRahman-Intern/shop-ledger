// FINANCIAL CALCULATIONS — pure functions, no I/O, no React.
//
// Why this file matters: money bugs destroy trust. Keeping every calculation here
// (and covered by `npm run test:finance`) means the UI never does its own arithmetic.
//
// Data model reminders:
//  - Amounts are INTEGERS in minor units (see CURRENCIES in appConfig).
//  - Records are append-only. Mistakes are fixed by VOIDING (voidedAt set), never by
//    editing or deleting, so the history stays auditable.
//  - A payment is split into "allocations" that say which credit sale(s) it settles.
//    A credit's remaining amount = credit.amount − sum(active allocations).
//  - Overpayment is not allowed: a payment can never exceed the customer's balance.
//    (Prepaid/advance balances would need a separate "customer credit" concept.)
//
// TODO(backend): Laravel must recompute allocations and balances inside a database
// transaction and never trust client-calculated numbers.

import { daysBetween, addDays } from './dates.js';

const EASTERN_ARABIC = /[٠-٩]/g; // ٠-٩
const EXTENDED_ARABIC = /[۰-۹]/g; // ۰-۹ (Persian/Pashto)

// Users in RTL languages may type native digits; convert them before parsing.
export function normalizeDigits(input) {
  return String(input)
    .replace(EASTERN_ARABIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC, (d) => String(d.charCodeAt(0) - 0x06f0));
}

// Parse what a person typed ("1,250.50", "۱۲۵۰", "1 250") into integer minor units.
// Returns null when the text is not a valid amount for this currency.
// Comma is always treated as a thousands separator, '.' or '٫' as the decimal point.
export function parseAmount(input, decimals = 0) {
  if (input == null) return null;
  const cleaned = normalizeDigits(input)
    .replace(/[\s ‎‏٬,]/g, '')
    .replace(/٫/g, '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [intPart, fracPart = ''] = cleaned.split('.');
  if (fracPart.length > decimals) return null; // e.g. "10.5" for a whole-number currency
  const minor = Number(intPart) * 10 ** decimals + Number(fracPart.padEnd(decimals, '0') || 0);
  if (!Number.isSafeInteger(minor) || minor > 1e13) return null;
  return minor;
}

// Minor units -> plain editable string ("1250.50"), used to prefill inputs.
export function minorToInput(minor, decimals = 0) {
  return (minor / 10 ** decimals).toFixed(decimals);
}

export const minorToNumber = (minor, decimals = 0) => minor / 10 ** decimals;

// Split a payment across a customer's open credits.
// Default is oldest-first (FIFO), which matches how shopkeepers think ("pay the old debt
// first"). A specific credit can be preferred, then any leftover flows FIFO.
// `openCredits`: [{ id, date, createdAt, remaining }]
export function allocatePayment(amount, openCredits, preferredCreditId = null) {
  const fifo = [...openCredits]
    .filter((c) => c.remaining > 0)
    .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  const ordered = preferredCreditId
    ? [...fifo.filter((c) => c.id === preferredCreditId), ...fifo.filter((c) => c.id !== preferredCreditId)]
    : fifo;

  let left = amount;
  const allocations = [];
  for (const credit of ordered) {
    if (left <= 0) break;
    const part = Math.min(left, credit.remaining);
    allocations.push({ creditId: credit.id, amount: part });
    left -= part;
  }
  return { allocations, unallocated: left }; // unallocated > 0 means overpayment
}

// LEDGER: derive everything from the raw append-only records.
// We never store balances, only compute them, so they cannot drift out of sync.
// Returns:
//  creditState: Map(creditId -> { paid, remaining, status, ageDays })
//  customers:   Map(customerId -> stats)
//  totals:      dashboard-level numbers
export function computeLedger({ customers, credits, payments, allocations }, { today, overdueDays = 30 }) {
  const activePaymentIds = new Set(payments.filter((p) => !p.voidedAt).map((p) => p.id));

  const paidByCredit = new Map();
  for (const a of allocations) {
    if (!activePaymentIds.has(a.paymentId)) continue; // voided payment => allocation ignored
    paidByCredit.set(a.creditId, (paidByCredit.get(a.creditId) || 0) + a.amount);
  }

  const creditState = new Map();
  const stats = new Map();
  const statFor = (customerId) => {
    if (!stats.has(customerId)) {
      stats.set(customerId, {
        totalCredit: 0, totalPaid: 0, balance: 0, overdueAmount: 0,
        openCredits: [], oldestOpenDate: null, oldestOpenAgeDays: 0,
        lastPaymentDate: null, lastCreditDate: null,
      });
    }
    return stats.get(customerId);
  };
  customers.forEach((c) => statFor(c.id));

  let creditSales = 0;
  let outstanding = 0;
  for (const credit of credits) {
    if (credit.voidedAt) {
      creditState.set(credit.id, { paid: 0, remaining: 0, status: 'void', ageDays: 0 });
      continue;
    }
    const paid = paidByCredit.get(credit.id) || 0;
    const remaining = credit.amount - paid;
    const status = remaining === 0 ? 'paid' : paid === 0 ? 'unpaid' : 'partial';
    const ageDays = Math.max(0, daysBetween(credit.date, today));
    creditState.set(credit.id, { paid, remaining, status, ageDays });

    const s = statFor(credit.customerId);
    s.totalCredit += credit.amount;
    creditSales += credit.amount;
    if (!s.lastCreditDate || credit.date > s.lastCreditDate) s.lastCreditDate = credit.date;
    if (remaining > 0) {
      outstanding += remaining;
      s.balance += remaining;
      s.openCredits.push(credit);
      if (!s.oldestOpenDate || credit.date < s.oldestOpenDate) s.oldestOpenDate = credit.date;
      if (ageDays >= overdueDays) s.overdueAmount += remaining;
    }
  }

  let collected = 0;
  for (const p of payments) {
    if (p.voidedAt) continue;
    collected += p.amount;
    const s = statFor(p.customerId);
    s.totalPaid += p.amount;
    if (!s.lastPaymentDate || p.date > s.lastPaymentDate) s.lastPaymentDate = p.date;
  }
  stats.forEach((s) => {
    if (s.oldestOpenDate) s.oldestOpenAgeDays = Math.max(0, daysBetween(s.oldestOpenDate, today));
    s.openCredits.sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  });

  const debtorCount = [...stats.values()].filter((s) => s.balance > 0).length;
  return { creditState, customers: stats, totals: { outstanding, collected, creditSales, debtorCount } };
}

// Sanity check used by the test script: balance computed two ways must agree.
export function verifyLedgerInvariants(data, ledger) {
  const problems = [];
  ledger.customers.forEach((s, customerId) => {
    if (s.balance !== s.totalCredit - s.totalPaid) problems.push(`Balance mismatch for ${customerId}`);
    if (s.balance < 0) problems.push(`Negative balance for ${customerId}`);
  });
  ledger.creditState.forEach((st, creditId) => {
    if (st.remaining < 0) problems.push(`Over-paid credit ${creditId}`);
  });
  return problems;
}

// Customers a shopkeeper should chase: owe money for longer than `overdueDays`.
// Sorted by the overdue amount (biggest problem first).
export function attentionList(ledger, customers, limit = 5) {
  return customers
    .filter((c) => !c.archived)
    .map((c) => ({ customer: c, stats: ledger.customers.get(c.id) }))
    .filter(({ stats }) => stats && stats.overdueAmount > 0)
    .sort((a, b) => b.stats.overdueAmount - a.stats.overdueAmount)
    .slice(0, limit);
}

// How old is the money owed to us? Buckets answer "is my debt getting stale?"
export function agingBuckets(data, ledger) {
  const buckets = [
    { key: 'd0_7', max: 7, amount: 0, count: 0 },
    { key: 'd8_30', max: 30, amount: 0, count: 0 },
    { key: 'd31_60', max: 60, amount: 0, count: 0 },
    { key: 'd60p', max: Infinity, amount: 0, count: 0 },
  ];
  for (const credit of data.credits) {
    const st = ledger.creditState.get(credit.id);
    if (!st || st.remaining <= 0) continue;
    const bucket = buckets.find((b) => st.ageDays <= b.max);
    bucket.amount += st.remaining;
    bucket.count += 1;
  }
  return buckets;
}

// Credit given and money collected in a date range (inclusive).
export function periodSummary(data, from, to) {
  let credit = 0, collected = 0, creditCount = 0, paymentCount = 0;
  for (const c of data.credits) {
    if (!c.voidedAt && c.date >= from && c.date <= to) { credit += c.amount; creditCount++; }
  }
  for (const p of data.payments) {
    if (!p.voidedAt && p.date >= from && p.date <= to) { collected += p.amount; paymentCount++; }
  }
  return { credit, collected, creditCount, paymentCount };
}

// Per-day series used by charts: [{ date, credit, collected }]
export function dailySeries(data, days) {
  const map = new Map(days.map((d) => [d, { date: d, credit: 0, collected: 0 }]));
  for (const c of data.credits) if (!c.voidedAt && map.has(c.date)) map.get(c.date).credit += c.amount;
  for (const p of data.payments) if (!p.voidedAt && map.has(p.date)) map.get(p.date).collected += p.amount;
  return days.map((d) => map.get(d));
}

// Per-month series: months = ['2026-06', ...]
export function monthlySeries(data, months) {
  const map = new Map(months.map((m) => [m, { month: m, credit: 0, collected: 0 }]));
  for (const c of data.credits) { const m = c.date.slice(0, 7); if (!c.voidedAt && map.has(m)) map.get(m).credit += c.amount; }
  for (const p of data.payments) { const m = p.date.slice(0, 7); if (!p.voidedAt && map.has(m)) map.get(m).collected += p.amount; }
  return months.map((m) => map.get(m));
}

// CUSTOMER STATEMENT
// Opening balance + credits − payments = closing balance, with a running balance on
// every line, so the customer can verify it against their own notebook.
export function buildStatement(customerId, data, { from, to }) {
  const credits = data.credits.filter((c) => c.customerId === customerId && !c.voidedAt);
  const payments = data.payments.filter((p) => p.customerId === customerId && !p.voidedAt);

  const previousBalance =
    credits.filter((c) => c.date < from).reduce((s, c) => s + c.amount, 0) -
    payments.filter((p) => p.date < from).reduce((s, p) => s + p.amount, 0);

  const lines = [
    ...credits.filter((c) => c.date >= from && c.date <= to).map((c) => ({
      kind: 'credit', id: c.id, date: c.date, createdAt: c.createdAt, description: c.description, debit: c.amount, credit: 0,
    })),
    ...payments.filter((p) => p.date >= from && p.date <= to).map((p) => ({
      kind: 'payment', id: p.id, date: p.date, createdAt: p.createdAt, description: p.note || '', method: p.method,
      number: p.serverNumber || p.number, debit: 0, credit: p.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.createdAt.localeCompare(b.createdAt) : a.kind === 'credit' ? -1 : 1));

  let running = previousBalance;
  for (const line of lines) {
    running += line.debit - line.credit;
    line.balance = running;
  }
  const totalCredits = lines.reduce((s, l) => s + l.debit, 0);
  const totalPayments = lines.reduce((s, l) => s + l.credit, 0);
  return { previousBalance, lines, totalCredits, totalPayments, closingBalance: running };
}

// Default statement period: from the first transaction (or 90 days) to today.
export function defaultStatementRange(today) {
  return { from: addDays(today, -90), to: today };
}
