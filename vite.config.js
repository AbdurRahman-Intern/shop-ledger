import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA: vite-plugin-pwa generates the service worker (Workbox) and precaches the
// built app shell, so the app opens and runs with no network after first load.
// User data lives in IndexedDB (see src/db), NOT in the service worker cache.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Shop Ledger — Customer Credit Tracker',
        short_name: 'Shop Ledger',
        description: 'Track customer credit, payments and balances — works offline.',
        theme_color: '#E11D74',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,woff}'],
        // SPA: serve index.html for every navigation so deep links work offline.
        navigateFallback: '/index.html',
      },
    }),
  ],
  base: '/shop-ledger/',
});
