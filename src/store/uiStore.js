// UI STORE — toasts and globally-available dialogs.
// Dialogs (record payment, new credit, add customer) are opened from anywhere —
// the header "+" button, a customer page, the dashboard — so their open/close state
// lives here instead of being passed through props.

import { create } from 'zustand';
import { uid } from '../lib/utils.js';

export const useUiStore = create((set, get) => ({
  toasts: [],
  // modals: { payment: { customerId? } | null, credit: {...}, customer: { customer? }, upgrade: { reason } }
  modals: { payment: null, credit: null, customer: null, upgrade: null },
  moreMenuOpen: false,

  // `message` is either a plain string or { key, params } resolved by <ToastHost/> with t().
  // Using keys keeps toasts fired from non-React code (the sync engine) translatable.
  toast: (type, message, { action = null, duration = 4500 } = {}) => {
    const id = uid('toast_');
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type, message, action }] }));
    if (duration) setTimeout(() => get().dismissToast(id), duration);
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  openModal: (name, props = {}) => set((s) => ({ modals: { ...s.modals, [name]: props } })),
  closeModal: (name) => set((s) => ({ modals: { ...s.modals, [name]: null } })),
  setMoreMenuOpen: (v) => set({ moreMenuOpen: v }),
}));
