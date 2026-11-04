// Run with: npm run test:finance
// Plain-Node sanity tests for the money logic (no test framework needed).
import assert from 'node:assert/strict';
import {
  parseAmount, allocatePayment, computeLedger, buildStatement, verifyLedgerInvariants, agingBuckets,
} from '../src/lib/finance.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

test('parseAmount handles plain, grouped and native digits', () => {
  assert.equal(parseAmount('1250', 0), 1250);
  assert.equal(parseAmount('1,250', 0), 1250);
  assert.equal(parseAmount('۱۲۵۰', 0), 1250);      // Persian digits
  assert.equal(parseAmount('١٢٥٠', 0), 1250);      // Arabic-Indic digits
  assert.equal(parseAmount('12.50', 2), 1250);
  assert.equal(parseAmount('12.5', 2), 1250);
  assert.equal(parseAmount('12٫5', 2), 1250);      // Arabic decimal separator
  assert.equal(parseAmount('0.1', 2) + parseAmount('0.2', 2), parseAmount('0.3', 2)); // no float drift
});

test('parseAmount rejects invalid input', () => {
  assert.equal(parseAmount('', 0), null);
  assert.equal(parseAmount('abc', 0), null);
  assert.equal(parseAmount('-5', 0), null);
  assert.equal(parseAmount('10.5', 0), null);      // fractions not allowed for whole-number currency
  assert.equal(parseAmount('1.234', 2), null);
});

test('allocatePayment is oldest-first and reports overpayment', () => {
  const open = [
    { id: 'b', date: '2026-02-01', createdAt: 'x', remaining: 300 },
    { id: 'a', date: '2026-01-01', createdAt: 'x', remaining: 500 },
  ];
  let r = allocatePayment(600, open);
  assert.deepEqual(r.allocations, [{ creditId: 'a', amount: 500 }, { creditId: 'b', amount: 100 }]);
  assert.equal(r.unallocated, 0);
  r = allocatePayment(900, open);
  assert.equal(r.unallocated, 100);
  r = allocatePayment(200, open, 'b'); // preferred credit first
  assert.deepEqual(r.allocations, [{ creditId: 'b', amount: 200 }]);
});

const base = {
  customers: [{ id: 'c1' }, { id: 'c2' }],
  credits: [
    { id: 'k1', customerId: 'c1', amount: 1000, date: '2026-01-01', createdAt: '1' },
    { id: 'k2', customerId: 'c1', amount: 500, date: '2026-01-10', createdAt: '2' },
    { id: 'k3', customerId: 'c2', amount: 200, date: '2026-01-05', createdAt: '3', voidedAt: 'now' },
  ],
  payments: [
    { id: 'p1', customerId: 'c1', amount: 1200, date: '2026-01-20', createdAt: '4' },
    { id: 'p2', customerId: 'c1', amount: 100, date: '2026-01-22', createdAt: '5', voidedAt: 'now' },
  ],
  allocations: [
    { id: 'a1', paymentId: 'p1', creditId: 'k1', amount: 1000 },
    { id: 'a2', paymentId: 'p1', creditId: 'k2', amount: 200 },
    { id: 'a3', paymentId: 'p2', creditId: 'k2', amount: 100 }, // voided payment: must be ignored
  ],
};

test('computeLedger: balances, statuses, voids ignored', () => {
  const l = computeLedger(base, { today: '2026-03-01', overdueDays: 30 });
  assert.equal(l.creditState.get('k1').status, 'paid');
  assert.equal(l.creditState.get('k2').status, 'partial');
  assert.equal(l.creditState.get('k2').remaining, 300);
  assert.equal(l.creditState.get('k3').status, 'void');
  assert.equal(l.customers.get('c1').balance, 300);
  assert.equal(l.customers.get('c2').balance, 0);
  assert.equal(l.totals.outstanding, 300);
  assert.equal(l.totals.collected, 1200);
  assert.equal(l.totals.creditSales, 1500);
  assert.equal(l.totals.debtorCount, 1);
  assert.deepEqual(verifyLedgerInvariants(base, l), []);
});

test('overdue amount respects overdueDays', () => {
  assert.equal(computeLedger(base, { today: '2026-01-20', overdueDays: 30 }).customers.get('c1').overdueAmount, 0);
  assert.equal(computeLedger(base, { today: '2026-03-01', overdueDays: 30 }).customers.get('c1').overdueAmount, 300);
});

test('buildStatement: previous + credits - payments = closing, running balance', () => {
  const s = buildStatement('c1', base, { from: '2026-01-05', to: '2026-02-01' });
  assert.equal(s.previousBalance, 1000);
  assert.equal(s.totalCredits, 500);
  assert.equal(s.totalPayments, 1200);
  assert.equal(s.closingBalance, 300);
  assert.equal(s.lines.at(-1).balance, 300);
});

test('aging buckets add up to outstanding', () => {
  const l = computeLedger(base, { today: '2026-03-01', overdueDays: 30 });
  const total = agingBuckets(base, l).reduce((s, b) => s + b.amount, 0);
  assert.equal(total, l.totals.outstanding);
});

console.log(`\n${passed} finance checks passed`);
