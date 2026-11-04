// INDEXEDDB LAYER
// All business data lives in IndexedDB so the app works fully offline and survives
// reloads. We use the small `idb` wrapper (promise API over raw IndexedDB).
//
// Every tenant-owned store has a `tenantId` index. ALL reads in the app go through
// `listByTenant`, which is how the frontend keeps businesses separate.
// IMPORTANT: this is a convenience, NOT security. Anyone with browser dev tools can read
// the whole database. Real isolation must be enforced by the Laravel backend on every request.
//
// Stores
//  users, tenants, members          -> identity & multi-tenancy (mock auth for the MVP)
//  customers, credits, payments, allocations -> the ledger (append-only; void instead of delete)
//  outbox                           -> pending operations queue for synchronization
//  serverLedger, serverOps          -> SIMULATED backend state (see src/sync/fakeServer.js).
//                                      Delete these two stores when a real API exists.
//  meta                             -> misc key/value (e.g. seed marker)

import { openDB } from 'idb';
import { APP } from '../config/appConfig.js';

export const STORES = {
  users: 'users',
  tenants: 'tenants',
  members: 'members',
  customers: 'customers',
  credits: 'credits',
  payments: 'payments',
  allocations: 'allocations',
  outbox: 'outbox',
  serverLedger: 'serverLedger',
  serverOps: 'serverOps',
  meta: 'meta',
};

const TENANT_STORES = ['members', 'customers', 'credits', 'payments', 'allocations', 'outbox'];

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(APP.dbName, APP.dbVersion, {
      // `upgrade` runs when the DB is created or dbVersion increases. Add new
      // `if (oldVersion < 2) {...}` blocks for future migrations; never edit old ones.
      upgrade(db) {
        const users = db.createObjectStore('users', { keyPath: 'id' });
        users.createIndex('email', 'email', { unique: true });
        db.createObjectStore('tenants', { keyPath: 'id' });

        // Tenant-owned stores all get a tenantId index; some get extra lookup indexes.
        const extraIndexes = {
          members: ['userId'], credits: ['customerId'], payments: ['customerId'],
          allocations: ['paymentId'], outbox: ['status'],
        };
        for (const name of TENANT_STORES) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('tenantId', 'tenantId');
          for (const field of extraIndexes[name] || []) store.createIndex(field, field);
        }

        db.createObjectStore('serverLedger', { keyPath: 'id' });
        db.createObjectStore('serverOps', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// Every record of a store for ONE tenant.
export async function listByTenant(store, tenantId) {
  const db = await getDb();
  return db.getAllFromIndex(store, 'tenantId', tenantId);
}

export async function getRecord(store, id) {
  const db = await getDb();
  return db.get(store, id);
}

export async function putRecord(store, record) {
  const db = await getDb();
  return db.put(store, record);
}

export async function getMeta(key) {
  const db = await getDb();
  return (await db.get('meta', key))?.value;
}

export async function setMeta(key, value) {
  const db = await getDb();
  return db.put('meta', { key, value });
}

// Wipe everything (used by "Reset demo data").
export async function clearAllStores() {
  const db = await getDb();
  const names = Object.values(STORES);
  const tx = db.transaction(names, 'readwrite');
  await Promise.all(names.map((n) => tx.objectStore(n).clear()));
  await tx.done;
}

// Load a tenant's full ledger snapshot in one go (customers, credits, payments, ...).
export async function loadTenantSnapshot(tenantId) {
  const [customers, credits, payments, allocations, outbox] = await Promise.all([
    listByTenant('customers', tenantId),
    listByTenant('credits', tenantId),
    listByTenant('payments', tenantId),
    listByTenant('allocations', tenantId),
    listByTenant('outbox', tenantId),
  ]);
  return { customers, credits, payments, allocations, outbox };
}
