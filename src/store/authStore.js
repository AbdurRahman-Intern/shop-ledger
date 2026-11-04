// AUTH STORE — who is signed in and which business (tenant) they are working in.
//
// The session holds only { userId, tenantId } in localStorage. The active tenant and role
// are re-read from IndexedDB at start-up.
// SECURITY: switching `tenantId` here is just UI state. In production the API token/
// session identifies the user and the SERVER verifies membership of the tenant on every request.
// TODO(backend): replace with Sanctum token auth; tenant sent as a header and re-authorized server-side.

import { create } from 'zustand';
import * as auth from '../services/authService.js';
import { STORAGE_KEYS } from '../config/appConfig.js';

const saveSession = (session) => {
  try {
    if (session) localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEYS.session);
  } catch { /* storage unavailable */ }
};
const loadSession = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null'); } catch { return null; }
};

// Derive tenant + role for a chosen tenantId from the membership list.
function select(memberships, tenantId) {
  const current = memberships.find((m) => m.tenant.id === tenantId) || memberships[0] || null;
  return { tenant: current?.tenant || null, role: current?.member.role || null, tenantId: current?.tenant.id || null };
}

export const useAuthStore = create((set, get) => ({
  ready: false, // false until we finished reading the stored session
  user: null,
  memberships: [], // [{ member, tenant }]
  tenant: null,
  tenantId: null,
  role: null,

  // Restore the previous session on app start.
  init: async () => {
    const session = loadSession();
    if (session?.userId) {
      const user = await auth.getUser(session.userId);
      if (user) {
        const memberships = await auth.listMemberships(user.id);
        set({ user, memberships, ...select(memberships, session.tenantId) });
        saveSession({ userId: user.id, tenantId: get().tenantId });
      } else saveSession(null);
    }
    set({ ready: true });
  },

  login: async (email, password) => {
    const user = await auth.login(email, password);
    const memberships = await auth.listMemberships(user.id);
    const picked = select(memberships, null);
    set({ user, memberships, ...picked });
    saveSession({ userId: user.id, tenantId: picked.tenantId });
    return { hasBusiness: memberships.length > 0 };
  },

  register: async (values) => {
    const user = await auth.registerUser(values);
    set({ user, memberships: [], tenant: null, tenantId: null, role: null });
    saveSession({ userId: user.id, tenantId: null });
  },

  logout: () => {
    saveSession(null);
    set({ user: null, memberships: [], tenant: null, tenantId: null, role: null });
  },

  switchTenant: (tenantId) => {
    const picked = select(get().memberships, tenantId);
    saveSession({ userId: get().user.id, tenantId: picked.tenantId });
    set(picked);
  },

  createBusiness: async (values) => {
    const { tenant } = await auth.createTenant(get().user.id, values);
    const memberships = await auth.listMemberships(get().user.id);
    saveSession({ userId: get().user.id, tenantId: tenant.id });
    set({ memberships, ...select(memberships, tenant.id) });
    return tenant;
  },

  // Re-read tenant record after settings/plan changes.
  updateBusiness: async (patch) => {
    const tenant = await auth.updateTenant(get().tenantId, patch);
    set({
      tenant,
      memberships: get().memberships.map((m) => (m.tenant.id === tenant.id ? { ...m, tenant } : m)),
    });
    return tenant;
  },
}));
