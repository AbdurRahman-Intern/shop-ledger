// Small shared hooks.

import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { can } from '../config/appConfig.js';
import { useSyncStore } from '../store/syncStore.js';
import { useUiStore } from '../store/uiStore.js';
import { scheduleSync, runSync } from '../sync/syncEngine.js';
import { useI18n } from '../i18n/useI18n.js';

// UI permission check: const canVoid = usePermission('records.void')
// (Frontend demonstration only — the backend enforces the real rules.)
export function usePermission(permission) {
  const role = useAuthStore((s) => s.role);
  return can(role, permission);
}

// Update document.title per page.
export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Shop Ledger` : 'Shop Ledger';
  }, [title]);
}

// Debounce a fast-changing value (search boxes).
export function useDebounced(value, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// Watch browser connectivity once for the whole app. When we come back online we sync at once;
// we also retry on a timer so "failed" operations recover without the user doing anything.
export function useConnectivityWatcher(t) {
  const setBrowserOnline = useSyncStore((s) => s.setBrowserOnline);
  const simulateOffline = useSyncStore((s) => s.simulateOffline);
  const browserOnline = useSyncStore((s) => s.browserOnline);

  useEffect(() => {
    const on = () => { setBrowserOnline(true); useUiStore.getState().toast('info', t('sync.toast.backOnline')); runSync({ reason: 'reconnect' }); };
    const off = () => { setBrowserOnline(false); useUiStore.getState().toast('warning', t('sync.toast.wentOffline')); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [setBrowserOnline, t]);

  // Toggling the demo switch behaves exactly like the real events above.
  useEffect(() => {
    if (!simulateOffline && browserOnline) scheduleSync(150);
  }, [simulateOffline, browserOnline]);

  useEffect(() => {
    const id = setInterval(() => runSync({ reason: 'auto' }), 30000);
    return () => clearInterval(id);
  }, []);
}

// "Install app" prompt (Chrome/Edge/Android). Safari uses Share → Add to Home Screen.
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches,
  );
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPromptEvent(e); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };
  return { canInstall: !!promptEvent, installed, install };
}

// Turn any thrown error into a translated message. AppError codes map to errors.<CODE>;
// anything unexpected becomes a generic message (details are logged, never shown raw).
export function useErrorText() {
  const { t, fmt } = useI18n();
  return (err) => {
    const code = err?.code;
    if (code && t(`errors.${code}`) !== `errors.${code}`) {
      const params = { ...(err.params || {}) };
      if (params.balance != null) params.balance = fmt.money(params.balance);
      return t(`errors.${code}`, params);
    }
    console.error(err);
    return t('errors.UNKNOWN');
  };
}
