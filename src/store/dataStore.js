// DATA STORE — in-memory copy of the ACTIVE business's ledger, backed by IndexedDB.
//
// Pattern: components read from this store (fast, synchronous); every action writes through
// ledgerService (IndexedDB + outbox) and then reloads the snapshot. Re-reading the whole
// tenant after each change is deliberately simple and correct for small shops.
// TODO(performance): for businesses with tens of thousands of records, update the affected
// rows incrementally or paginate instead of reloading everything.
// TODO(backend): hydrate from GET /api/bootstrap (TanStack Query) and keep IndexedDB as the offline cache.

import { create } from 'zustand';
import { loadTenantSnapshot } from '../db/index.js';
import * as ledger from '../services/ledgerService.js';
import { useAuthStore } from './authStore.js';
import { scheduleSync } from '../sync/syncEngine.js';
import { can, PLANS } from '../config/appConfig.js';
import { AppError } from '../lib/utils.js';
import { SYNC } from '../config/appConfig.js';

const ctx = () => {
  const { tenantId, user } = useAuthStore.getState();
  if (!tenantId || !user) throw new AppError('NOT_SIGNED_IN');
  return { tenantId, userId: user.id };
};

// UI-level permission guard. Real enforcement is a backend Policy; this keeps the demo honest.
const requireCan = (permission) => {
  if (!can(useAuthStore.getState().role, permission)) throw new AppError('FORBIDDEN');
};

export const useDataStore = create((set, get) => ({
  tenantId: null,
  customers: [], credits: [], payments: [], allocations: [], outbox: [],
  loading: true,
  error: null,

  load: async (tenantId) => {
    set({ loading: true, error: null, tenantId });
    try {
      const snapshot = await loadTenantSnapshot(tenantId);
      // Ignore stale responses if the user switched business while we were loading.
      if (get().tenantId === tenantId) set({ ...snapshot, loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false, error: 'LOAD_FAILED' });
    }
  },

  reload: async () => {
    const tenantId = get().tenantId;
    if (!tenantId) return;
    const snapshot = await loadTenantSnapshot(tenantId);
    if (get().tenantId === tenantId) set({ ...snapshot });
  },

  // After every successful local write: refresh UI, then try to sync in the background.
  _afterWrite: async () => {
    await get().reload();
    scheduleSync();
  },

  addCustomer: async (values) => {
    requireCan('customers.edit');
    // Plan limit (UI only). TODO(backend): server enforces limits on create.
    const { tenant } = useAuthStore.getState();
    const limit = PLANS[tenant.subscription.planId].limits.customers;
    if (limit !== null && get().customers.filter((c) => !c.archived).length >= limit) throw new AppError('PLAN_LIMIT_CUSTOMERS');
    const customer = await ledger.createCustomer(ctx(), values);
    await get()._afterWrite();
    return customer;
  },

  editCustomer: async (id, changes) => {
    requireCan('customers.edit');
    const customer = await ledger.updateCustomer(ctx(), id, changes);
    await get()._afterWrite();
    return customer;
  },

  setArchived: async (id, archived) => {
    requireCan('customers.archive');
    await ledger.updateCustomer(ctx(), id, { archived });
    await get()._afterWrite();
  },

  addCredit: async (values) => {
    const credit = await ledger.createCredit(ctx(), values);
    await get()._afterWrite();
    return credit;
  },

  addPayment: async (values) => {
    const result = await ledger.recordPayment(ctx(), values);
    await get()._afterWrite();
    return result;
  },

  voidPayment: async (id, reason) => {
    requireCan('records.void');
    await ledger.voidPayment(ctx(), id, reason);
    await get()._afterWrite();
  },

  voidCredit: async (id, reason) => {
    requireCan('records.void');
    await ledger.voidCredit(ctx(), id, reason);
    await get()._afterWrite();
  },

  // Helps prevent the classic double-tap duplicate: same customer + amount + date + text
  // saved in the last couple of minutes.
  findRecentDuplicateCredit: ({ customerId, amount, date, description }) => {
    const since = Date.now() - SYNC.duplicateWindowMs;
    return get().credits.find(
      (c) => !c.voidedAt && c.customerId === customerId && c.amount === amount && c.date === date &&
        (c.description || '') === (description || '').trim() && new Date(c.createdAt).getTime() > since,
    );
  },
}));

// Per-record sync status shown as a badge. "syncing" is derived from the outbox so a record
// shows a spinner only while its own operation is in flight.
export function recordSyncStatus(record, outbox) {
  if (outbox.some((o) => o.entityId === record.id && o.status === 'syncing')) return 'syncing';
  return record.syncStatus || 'synced';
}
