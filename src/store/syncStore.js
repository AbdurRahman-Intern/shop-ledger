// SYNC STORE — connectivity + synchronization state shown in the header pill.
//
// "Online" is computed from TWO inputs:
//   browserOnline   : navigator.onLine (can be wrong — captive portals, dead Wi-Fi)
//   simulateOffline : a manual switch so you can demo offline mode without unplugging anything
// TODO(backend): also treat "API unreachable" (failed health check) as offline.

import { create } from 'zustand';
import { STORAGE_KEYS } from '../config/appConfig.js';

const readSim = () => {
  try { return localStorage.getItem(STORAGE_KEYS.simulateOffline) === '1'; } catch { return false; }
};

export const useSyncStore = create((set, get) => ({
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  simulateOffline: readSim(),
  syncing: false,
  lastSyncAt: null,
  lastRunFailed: false,

  // One-shot demo switches that make the next sync misbehave (see Sync Center).
  flags: { failNext: false, conflictNext: false, loseResponseNext: false },

  isOnline: () => get().browserOnline && !get().simulateOffline,

  setBrowserOnline: (v) => set({ browserOnline: v }),
  setSimulateOffline: (v) => {
    try { localStorage.setItem(STORAGE_KEYS.simulateOffline, v ? '1' : '0'); } catch { /* storage unavailable */ }
    set({ simulateOffline: v });
  },
  setSyncing: (syncing) => set({ syncing }),
  finishRun: ({ failed }) => set({ syncing: false, lastRunFailed: failed, lastSyncAt: failed ? get().lastSyncAt : new Date().toISOString() }),

  setFlag: (name, value) => set((s) => ({ flags: { ...s.flags, [name]: value } })),
  // Returns true exactly once per armed flag.
  consumeFlag: (name) => {
    if (!get().flags[name]) return false;
    set((s) => ({ flags: { ...s.flags, [name]: false } }));
    return true;
  },
}));
