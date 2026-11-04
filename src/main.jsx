// APP ENTRY — boot sequence:
//  1. Apply saved language to <html> (before first paint, so RTL never flashes wrong).
//  2. Open IndexedDB and seed the demo businesses on first launch.
//  3. Restore the previous session, then render.
// Everything is local, so this works with no network at all.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.jsx';
import { applyDocumentLanguage, usePrefsStore } from './store/prefsStore.js';
import { useAuthStore } from './store/authStore.js';
import { seedIfEmpty } from './mock/seed.js';
import { translate } from './i18n/useI18n.js';

applyDocumentLanguage(usePrefsStore.getState().language);

// TanStack Query is wired in for the FUTURE Laravel API (see src/api/contract.js).
// TODO(backend): replace dataStore.load() with useQuery(['bootstrap', tenantId], api.bootstrap)
// and mutations with useMutation + the sync outbox.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, networkMode: 'offlineFirst' } } });

// Service worker: caches the app shell so the app opens offline. Updates apply on next launch.
registerSW({ immediate: true });

const root = createRoot(document.getElementById('root'));

async function boot() {
  try {
    await seedIfEmpty();
    await useAuthStore.getState().init();
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter><App /></BrowserRouter>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  } catch (err) {
    console.error('Boot failed', err);
    const lang = usePrefsStore.getState().language;
    root.render(
      <div role="alert" style={{ padding: 32, textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{translate(lang, 'boot.failedTitle')}</h1>
        <p style={{ marginTop: 8, color: '#5C5359' }}>{translate(lang, 'boot.failedText')}</p>
      </div>,
    );
  }
}
boot();
