// LEDGER SERVICE — the only place that writes financial records.
//
// Rules enforced here (and which Laravel must enforce again):
//  1. Every record carries tenantId and is checked against the caller's tenant.
//  2. Records are append-only. Mistakes are VOIDED with a reason, never edited/deleted.
//  3. A record and its outbox operation are written in ONE IndexedDB transaction, so a
//     crash can never leave a payment that will not sync (or an op without a payment).
//  4. Payments cannot exceed the customer's balance, and are split into allocations.
//
// `ctx` = { tenantId, userId } of the signed-in user.

import { getDb } from '../db/index.js';
import { computeLedger, allocatePayment } from '../lib/finance.js';
import { todayISO } from '../lib/dates.js';
import { uid, AppError } from '../lib/utils.js';
import { validateCustomer, validateDate } from '../lib/validation.js';

const nowISO = () => new Date().toISOString();

// Queue an operation for synchronization. `id` is the IDEMPOTENCY KEY: the backend
// remembers it and ignores repeats, so retrying after a lost response never duplicates money.
function enqueue(tx, ctx, { type, entity, entityId, customerId, payload, baseVersion = null }) {
  return tx.objectStore('outbox').put({
    id: uid('op_'), tenantId: ctx.tenantId, type, entity, entityId, customerId, payload,
    baseVersion, status: 'pending', attempts: 0, lastError: null, createdAt: nowISO(),
  });
}

function assertTenant(record, ctx) {
  // Defence-in-depth only. TODO(backend): enforce with tenant-scoped queries + Policies.
  if (!record || record.tenantId !== ctx.tenantId) throw new AppError('TENANT_MISMATCH');
}

// ---- Customers --------------------------------------------------------------------------

export async function createCustomer(ctx, values) {
  const errors = validateCustomer(values);
  if (Object.keys(errors).length) throw new AppError('VALIDATION', { errors });

  const now = nowISO();
  const customer = {
    id: uid('cus_'), tenantId: ctx.tenantId,
    name: values.name.trim(), phone: (values.phone || '').trim(),
    address: (values.address || '').trim(), note: (values.note || '').trim(),
    archived: false, createdAt: now, updatedAt: now, createdBy: ctx.userId,
    syncStatus: 'pending', serverId: null, serverVersion: null,
  };
  const db = await getDb();
  const tx = db.transaction(['customers', 'outbox'], 'readwrite');
  await tx.objectStore('customers').put(customer);
  await enqueue(tx, ctx, {
    type: 'customer.create', entity: 'customer', entityId: customer.id, customerId: customer.id,
    payload: { name: customer.name, phone: customer.phone, address: customer.address, note: customer.note },
  });
  await tx.done;
  return customer;
}

export async function updateCustomer(ctx, customerId, changes) {
  const db = await getDb();
  const tx = db.transaction(['customers', 'outbox'], 'readwrite');
  const customer = await tx.objectStore('customers').get(customerId);
  assertTenant(customer, ctx);

  const merged = { ...customer, ...changes };
  const errors = validateCustomer(merged);
  if (Object.keys(errors).length) throw new AppError('VALIDATION', { errors });

  const updated = {
    ...merged, name: merged.name.trim(), phone: (merged.phone || '').trim(),
    updatedAt: nowISO(), syncStatus: 'pending',
  };
  await tx.objectStore('customers').put(updated);
  // baseVersion = the server version this edit was based on; the backend compares it to
  // detect that someone else changed the customer meanwhile (conflict detection).
  await enqueue(tx, ctx, {
    type: 'customer.update', entity: 'customer', entityId: customerId, customerId,
    payload: { changes }, baseVersion: customer.serverVersion,
  });
  await tx.done;
  return updated;
}

// ---- Credit sales -----------------------------------------------------------------------

export async function createCredit(ctx, { customerId, amount, description, date }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new AppError('VALIDATION', { errors: { amount: 'amountPositive' } });
  const dateError = validateDate(date);
  if (dateError) throw new AppError('VALIDATION', { errors: { date: dateError } });

  const db = await getDb();
  const tx = db.transaction(['customers', 'credits', 'outbox'], 'readwrite');
  const customer = await tx.objectStore('customers').get(customerId);
  assertTenant(customer, ctx);
  if (customer.archived) throw new AppError('CUSTOMER_ARCHIVED');

  const credit = {
    id: uid('crd_'), tenantId: ctx.tenantId, customerId, amount,
    description: (description || '').trim(), date, createdAt: nowISO(), createdBy: ctx.userId,
    syncStatus: 'pending', serverId: null, voidedAt: null, voidReason: null,
  };
  await tx.objectStore('credits').put(credit);
  await enqueue(tx, ctx, {
    type: 'credit.create', entity: 'credit', entityId: credit.id, customerId,
    payload: { amount, description: credit.description, date },
  });
  await tx.done;
  return credit;
}

// ---- Payments ---------------------------------------------------------------------------

// Short human-friendly number shown until the server assigns the official sequential
// receipt number (R-00042). Avoids duplicate numbers when several devices are offline.
const draftNumber = () => 'D-' + uid().replace(/-/g, '').slice(0, 5).toUpperCase();

export async function recordPayment(ctx, { customerId, amount, date, method, note, creditId = null }) {
  if (!Number.isInteger(amount) || amount <= 0) throw new AppError('VALIDATION', { errors: { amount: 'amountPositive' } });
  const dateError = validateDate(date);
  if (dateError) throw new AppError('VALIDATION', { errors: { date: dateError } });

  const db = await getDb();
  const tx = db.transaction(['customers', 'credits', 'payments', 'allocations', 'outbox'], 'readwrite');
  const customer = await tx.objectStore('customers').get(customerId);
  assertTenant(customer, ctx);

  // Re-read the customer's records INSIDE the transaction so the balance check uses
  // the freshest local data (two quick taps cannot both pass the check).
  const credits = await tx.objectStore('credits').index('customerId').getAll(customerId);
  const payments = await tx.objectStore('payments').index('customerId').getAll(customerId);
  const allocations = (await Promise.all(payments.map((p) => tx.objectStore('allocations').index('paymentId').getAll(p.id)))).flat();
  const ledger = computeLedger({ customers: [customer], credits, payments, allocations }, { today: todayISO() });
  const stats = ledger.customers.get(customerId);

  if (amount > stats.balance) throw new AppError('OVERPAYMENT', { balance: stats.balance });

  const open = stats.openCredits.map((c) => ({ ...c, remaining: ledger.creditState.get(c.id).remaining }));
  const { allocations: parts } = allocatePayment(amount, open, creditId);

  const payment = {
    id: uid('pay_'), tenantId: ctx.tenantId, customerId, amount, date,
    method: method || 'cash', note: (note || '').trim(), createdAt: nowISO(), createdBy: ctx.userId,
    number: draftNumber(), serverNumber: null, syncStatus: 'pending', serverId: null,
    voidedAt: null, voidReason: null,
  };
  await tx.objectStore('payments').put(payment);
  const savedAllocations = parts.map((p) => ({ id: uid('alc_'), tenantId: ctx.tenantId, paymentId: payment.id, creditId: p.creditId, amount: p.amount }));
  for (const a of savedAllocations) await tx.objectStore('allocations').put(a);

  // TODO(backend): the server must IGNORE client allocations and recompute them itself.
  await enqueue(tx, ctx, {
    type: 'payment.create', entity: 'payment', entityId: payment.id, customerId,
    payload: { amount, date, method: payment.method, note: payment.note, allocations: savedAllocations.map(({ creditId, amount: a }) => ({ creditId, amount: a })) },
  });
  await tx.done;
  return { payment, allocations: savedAllocations };
}

// ---- Voiding (the audit-friendly replacement for edit/delete) ----------------------------

export async function voidPayment(ctx, paymentId, reason) {
  const db = await getDb();
  const tx = db.transaction(['payments', 'outbox'], 'readwrite');
  const payment = await tx.objectStore('payments').get(paymentId);
  assertTenant(payment, ctx);
  if (payment.voidedAt) throw new AppError('ALREADY_VOID');
  const updated = { ...payment, voidedAt: nowISO(), voidReason: reason || '', voidedBy: ctx.userId, syncStatus: 'pending' };
  await tx.objectStore('payments').put(updated);
  await enqueue(tx, ctx, {
    type: 'payment.void', entity: 'payment', entityId: paymentId, customerId: payment.customerId,
    payload: { reason: reason || '', amount: payment.amount },
  });
  await tx.done;
  return updated;
}

export async function voidCredit(ctx, creditId, reason) {
  const db = await getDb();
  const tx = db.transaction(['credits', 'payments', 'allocations', 'outbox'], 'readwrite');
  const credit = await tx.objectStore('credits').get(creditId);
  assertTenant(credit, ctx);
  if (credit.voidedAt) throw new AppError('ALREADY_VOID');

  // A credit that already received money cannot vanish; void those payments first.
  const allocations = await tx.objectStore('allocations').getAll();
  const payments = await tx.objectStore('payments').index('customerId').getAll(credit.customerId);
  const activePaymentIds = new Set(payments.filter((p) => !p.voidedAt).map((p) => p.id));
  if (allocations.some((a) => a.creditId === creditId && activePaymentIds.has(a.paymentId))) throw new AppError('CREDIT_HAS_PAYMENTS');

  const updated = { ...credit, voidedAt: nowISO(), voidReason: reason || '', voidedBy: ctx.userId, syncStatus: 'pending' };
  await tx.objectStore('credits').put(updated);
  await enqueue(tx, ctx, {
    type: 'credit.void', entity: 'credit', entityId: creditId, customerId: credit.customerId,
    payload: { reason: reason || '', amount: credit.amount },
  });
  await tx.done;
  return updated;
}
