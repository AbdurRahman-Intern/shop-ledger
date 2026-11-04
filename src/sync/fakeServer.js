// SIMULATED BACKEND — delete this file when the Laravel API exists.
//
// It lives in IndexedDB (stores `serverLedger` and `serverOps`) so it survives reloads and
// behaves like a real server that keeps its own state, independent of the client's copy.
// It demonstrates the behaviours a production sync endpoint MUST have:
//
//  1. IDEMPOTENCY   — each operation carries a unique id. If the same id arrives twice
//                     (e.g. the response was lost and the app retried) the server returns the
//                     stored result instead of recording the payment again. No double charges.
//  2. SERVER IDs    — the server assigns its own id and the official sequential receipt number.
//  3. CONFLICTS     — if the server's state differs from what the client assumed (customer
//                     edited elsewhere, balance already reduced elsewhere) the operation is
//                     REJECTED with a conflict. Financial data is never silently overwritten.
//  4. VALIDATION    — a payment can never exceed the balance the server knows about.
//
// Laravel mapping (TODO): POST /api/sync/operations with header `Idempotency-Key: <op.id>`;
// unique index on (tenant_id, client_uuid); wrap each operation in DB::transaction(); return
// 409 Conflict with the server's current record for conflicts.

import { getDb } from '../db/index.js';
import { sleep } from '../lib/utils.js';
import { SYNC } from '../config/appConfig.js';

// `consume(flagName)` is provided by the sync store: it returns true once and clears a
// one-shot demo flag (failNext / conflictNext / loseResponseNext).
export async function processOp(op, consume) {
  await sleep(SYNC.latencyMin + Math.random() * (SYNC.latencyMax - SYNC.latencyMin));

  // Demo switch: the server is down. Nothing is applied.
  if (consume('failNext')) return { ok: false, type: 'server', code: 'SERVER_UNAVAILABLE' };

  const db = await getDb();

  // 1. Idempotency check — have we already applied this exact operation?
  const prior = await db.get('serverOps', op.id);
  if (prior) return { ok: true, duplicate: true, result: prior.result };

  const tx = db.transaction(['serverLedger', 'serverOps'], 'readwrite');
  const ledger = tx.objectStore('serverLedger');
  const nextSeq = async (name) => {
    const row = (await ledger.get(`seq:${op.tenantId}:${name}`)) || { id: `seq:${op.tenantId}:${name}`, kind: 'seq', value: 0 };
    row.value += 1;
    await ledger.put(row);
    return row.value;
  };
  const customerRow = async () =>
    (await ledger.get(`cus:${op.customerId}`)) ||
    { id: `cus:${op.customerId}`, kind: 'customer', tenantId: op.tenantId, version: 0, credits: 0, payments: 0, snapshot: {} };

  let result = {};
  const p = op.payload;

  switch (op.type) {
    case 'customer.create': {
      const row = await customerRow();
      row.version = 1;
      row.snapshot = { ...p, archived: false };
      await ledger.put(row);
      result = { serverId: `srv_${await nextSeq('server')}`, serverVersion: 1 };
      break;
    }
    case 'customer.update': {
      const row = await customerRow();
      // Demo switch: pretend another device edited this customer first.
      if (consume('conflictNext')) {
        row.version += 1;
        row.snapshot = { ...row.snapshot, note: [row.snapshot.note, 'edited on another device'].filter(Boolean).join(' · ') };
        await ledger.put(row);
        await tx.done;
        return { ok: false, type: 'conflict', code: 'CUSTOMER_CHANGED', serverRecord: { version: row.version, snapshot: row.snapshot } };
      }
      if (op.baseVersion != null && op.baseVersion !== row.version) {
        await tx.done;
        return { ok: false, type: 'conflict', code: 'CUSTOMER_CHANGED', serverRecord: { version: row.version, snapshot: row.snapshot } };
      }
      row.version += 1;
      row.snapshot = { ...row.snapshot, ...p.changes };
      await ledger.put(row);
      result = { serverVersion: row.version };
      break;
    }
    case 'credit.create': {
      const row = await customerRow();
      row.credits += p.amount;
      await ledger.put(row);
      result = { serverId: `srv_${await nextSeq('server')}` };
      break;
    }
    case 'payment.create': {
      const row = await customerRow();
      const balance = row.credits - row.payments;
      // Demo switch: another device already collected money from this customer.
      if (consume('conflictNext')) {
        await tx.done;
        return { ok: false, type: 'conflict', code: 'BALANCE_CHANGED', serverBalance: Math.max(0, balance - 1) };
      }
      if (p.amount > balance) {
        await tx.done;
        return { ok: false, type: 'conflict', code: 'BALANCE_EXCEEDED', serverBalance: balance };
      }
      row.payments += p.amount;
      await ledger.put(row);
      const receipt = await nextSeq('receipt');
      result = { serverId: `srv_${await nextSeq('server')}`, serverNumber: `R-${String(receipt).padStart(5, '0')}` };
      break;
    }
    case 'credit.void': {
      const row = await customerRow();
      row.credits -= p.amount;
      await ledger.put(row);
      break;
    }
    case 'payment.void': {
      const row = await customerRow();
      row.payments -= p.amount;
      await ledger.put(row);
      break;
    }
    default:
      await tx.done;
      return { ok: false, type: 'server', code: 'UNKNOWN_OPERATION' };
  }

  await tx.objectStore('serverOps').put({ id: op.id, result, appliedAt: new Date().toISOString() });
  await tx.done;

  // Demo switch: the server APPLIED the change but the reply never reached the app.
  // The client cannot know that, so it will retry. The idempotency check above makes the
  // retry safe — this is the single most important property for financial sync.
  if (consume('loseResponseNext')) return { ok: false, type: 'network', code: 'RESPONSE_LOST' };

  return { ok: true, duplicate: false, result };
}
