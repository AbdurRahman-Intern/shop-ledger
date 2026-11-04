// SYNC ENGINE — drains the local outbox (pending operations queue) to the server.
//
// How it works
//  - Every local write also adds an operation to the `outbox` (see ledgerService).
//  - When online, we send operations ONE AT A TIME in creation order (FIFO) so a payment can
//    never reach the server before the credit it pays.
//  - Per operation the server answers one of:
//      ok         -> delete the op, store serverId / receipt number, mark record "synced"
//      conflict   -> keep the op as "conflict" and ask the USER (never auto-overwrite money)
//      error      -> mark "failed", STOP the run (network is likely down), retry later
//  - A conflict only blocks later operations of the SAME customer; others continue.
//  - Because the server is idempotent, retrying is always safe.
//
// What this is NOT: a complete production sync system. See README "Backend integration"
// for the server-side work (idempotency keys, tenant-scoped transactions, server-side
// allocation, conflict API, audit log, pull/delta sync for data created on other devices).
// TODO(backend): replace processOp() with a real fetch to POST /api/sync/operations.
// TODO(backend): add a PULL step (GET /api/changes?since=cursor) so devices receive each other's data.

import { getDb } from '../db/index.js';
import { processOp } from './fakeServer.js';
import { useSyncStore } from '../store/syncStore.js';
import { useDataStore } from '../store/dataStore.js';
import { useUiStore } from '../store/uiStore.js';

const ENTITY_STORE = { customer: 'customers', credit: 'credits', payment: 'payments' };
const ALL_STORES = ['outbox', 'customers', 'credits', 'payments', 'allocations'];

let running = false;
let debounceTimer = null;

// Run a sync shortly after a local change (debounced so rapid saves batch together).
export function scheduleSync(delay = 350) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSync({ reason: 'auto' }), delay);
}

// If the tab was closed mid-request, ops are stuck in "syncing". The server may or may
// not have applied them; resetting to "pending" is safe BECAUSE retries are idempotent.
export async function recoverInterruptedOps() {
  const db = await getDb();
  const ops = await db.getAll('outbox');
  for (const op of ops.filter((o) => o.status === 'syncing')) await db.put('outbox', { ...op, status: 'pending' });
}

// Record-level status is derived from its operations: conflict > failed > pending > synced.
async function settleRecord(tx, entity, entityId, patch = {}) {
  const store = tx.objectStore(ENTITY_STORE[entity]);
  const record = await store.get(entityId);
  if (!record) return;
  const ops = (await tx.objectStore('outbox').index('tenantId').getAll(record.tenantId)).filter((o) => o.entityId === entityId);
  let syncStatus = 'synced';
  if (ops.some((o) => o.status === 'conflict')) syncStatus = 'conflict';
  else if (ops.some((o) => o.status === 'failed')) syncStatus = 'failed';
  else if (ops.length) syncStatus = 'pending';
  await store.put({ ...record, ...patch, syncStatus });
}

async function markSyncing(op) {
  const db = await getDb();
  await db.put('outbox', { ...op, status: 'syncing' });
  await useDataStore.getState().reload();
}

async function applySuccess(op, result) {
  const db = await getDb();
  const tx = db.transaction(ALL_STORES, 'readwrite');
  await tx.objectStore('outbox').delete(op.id);
  const patch = {};
  if (result.serverId) patch.serverId = result.serverId;
  if (result.serverNumber) patch.serverNumber = result.serverNumber;
  if (result.serverVersion) patch.serverVersion = result.serverVersion;
  await settleRecord(tx, op.entity, op.entityId, patch);
  await tx.done;
}

async function applyFailure(op, res) {
  const db = await getDb();
  const tx = db.transaction(ALL_STORES, 'readwrite');
  await tx.objectStore('outbox').put({
    ...op, status: 'failed', attempts: op.attempts + 1,
    lastError: { code: res.code, type: res.type }, lastAttemptAt: new Date().toISOString(),
  });
  await settleRecord(tx, op.entity, op.entityId);
  await tx.done;
}

async function applyConflict(op, res) {
  const db = await getDb();
  const tx = db.transaction(ALL_STORES, 'readwrite');
  await tx.objectStore('outbox').put({
    ...op, status: 'conflict', attempts: op.attempts + 1,
    lastError: { code: res.code, type: 'conflict' }, lastAttemptAt: new Date().toISOString(),
    serverRecord: res.serverRecord || null, serverBalance: res.serverBalance ?? null,
  });
  await settleRecord(tx, op.entity, op.entityId);
  await tx.done;
}

// reason: 'auto' (after a save / timer) | 'manual' (button) | 'reconnect' (back online)
export async function runSync({ reason = 'auto' } = {}) {
  const sync = useSyncStore.getState();
  const ui = useUiStore.getState();
  if (running) return;
  if (!sync.isOnline()) {
    if (reason === 'manual') ui.toast('warning', { key: 'sync.toast.offline' });
    return;
  }

  const db = await getDb();
  const all = await db.getAll('outbox');
  const queue = all.filter((o) => o.status === 'pending' || o.status === 'failed').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (queue.length === 0) {
    if (reason === 'manual') ui.toast('success', { key: 'sync.toast.nothingToSync' });
    return;
  }

  running = true;
  sync.setSyncing(true);
  const blockedCustomers = new Set(all.filter((o) => o.status === 'conflict').map((o) => o.customerId));
  let synced = 0, duplicates = 0, conflicts = 0, failed = false;

  try {
    for (const op of queue) {
      // Stop immediately if the connection is switched off mid-run.
      if (!useSyncStore.getState().isOnline()) { failed = true; break; }
      if (blockedCustomers.has(op.customerId)) continue; // keep per-customer ordering

      await markSyncing(op);
      const res = await processOp(op, useSyncStore.getState().consumeFlag);
      if (res.ok) {
        await applySuccess(op, res.result);
        synced += 1;
        if (res.duplicate) duplicates += 1;
      } else if (res.type === 'conflict') {
        await applyConflict(op, res);
        blockedCustomers.add(op.customerId);
        conflicts += 1;
      } else {
        await applyFailure(op, res);
        failed = true;
        break; // network/server trouble: stop, keep order, retry later
      }
      await useDataStore.getState().reload();
    }
  } finally {
    running = false;
    sync.finishRun({ failed });
    await useDataStore.getState().reload();
  }

  if (failed) ui.toast('error', { key: 'sync.toast.failed' });
  if (conflicts) ui.toast('warning', { key: 'sync.toast.conflicts' });
  if (duplicates) ui.toast('info', { key: 'sync.toast.duplicateSafe' });
  if (!failed && !conflicts && synced && (reason === 'manual' || reason === 'reconnect')) {
    ui.toast('success', { key: 'sync.toast.synced', params: { count: synced } });
  }
}

// ---- Manual actions from the Sync Center -------------------------------------------------

export async function retryOp(opId) {
  const db = await getDb();
  const op = await db.get('outbox', opId);
  if (op) await db.put('outbox', { ...op, status: 'pending' });
  await useDataStore.getState().reload();
  await runSync({ reason: 'manual' });
}

export async function retryAllFailed() {
  const db = await getDb();
  for (const op of (await db.getAll('outbox')).filter((o) => o.status === 'failed')) await db.put('outbox', { ...op, status: 'pending' });
  await runSync({ reason: 'manual' });
}

// Customer edit conflict: the user explicitly chooses whose version wins.
//  'server' -> adopt the server's data and drop the local edit
//  'mine'   -> keep local edit, re-send based on the server's latest version
export async function resolveCustomerConflict(opId, choice) {
  const db = await getDb();
  const op = await db.get('outbox', opId);
  if (!op || !op.serverRecord) return;

  if (choice === 'server') {
    const tx = db.transaction(ALL_STORES, 'readwrite');
    const customer = await tx.objectStore('customers').get(op.entityId);
    await tx.objectStore('customers').put({ ...customer, ...op.serverRecord.snapshot, serverVersion: op.serverRecord.version, updatedAt: new Date().toISOString() });
    await tx.objectStore('outbox').delete(op.id);
    await settleRecord(tx, 'customer', op.entityId);
    await tx.done;
    await useDataStore.getState().reload();
    useUiStore.getState().toast('success', { key: 'sync.toast.resolvedServer' });
  } else {
    await db.put('outbox', { ...op, status: 'pending', baseVersion: op.serverRecord.version, serverRecord: null });
    await useDataStore.getState().reload();
    await runSync({ reason: 'manual' });
  }
}

// Discard a credit/payment that the server could not accept. It is NOT deleted: it stays
// visible, marked "discarded", so the audit trail shows what happened. Only allowed while
// the server has never seen it (create op still queued).
export async function discardOp(opId) {
  const db = await getDb();
  const op = await db.get('outbox', opId);
  if (!op || !['credit', 'payment'].includes(op.entity)) return;
  const tx = db.transaction(ALL_STORES, 'readwrite');
  const related = (await tx.objectStore('outbox').index('tenantId').getAll(op.tenantId)).filter((o) => o.entityId === op.entityId);
  for (const o of related) await tx.objectStore('outbox').delete(o.id);
  const store = tx.objectStore(ENTITY_STORE[op.entity]);
  const record = await store.get(op.entityId);
  await store.put({ ...record, voidedAt: new Date().toISOString(), voidReason: 'sync_discarded', syncStatus: 'discarded' });
  await tx.done;
  await useDataStore.getState().reload();
  useUiStore.getState().toast('info', { key: 'sync.toast.discarded' });
}
