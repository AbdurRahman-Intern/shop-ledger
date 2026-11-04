# Shop Ledger — Customer Credit & Payment Tracker

A multi-tenant SaaS **frontend MVP** for small shops that sell on credit. Record credit sales, take
(partial) payments, print receipts and statements, and see who owes what — **fully offline-capable**,
in **English, العربية, دری and پښتو** (full RTL).

Built with **React + Vite + JavaScript** (no TypeScript), Tailwind CSS, React Router, Zustand,
TanStack Query (wired for the future API), Recharts, Lucide icons and IndexedDB (`idb`).

> This is a frontend-first build. All data lives in the browser (IndexedDB) and a **simulated server**
> demonstrates synchronization. Nothing here is secure multi-tenancy yet — see
> [What remains for backend integration](#what-remains-for-backend-integration).

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Production build (+ service worker for offline/PWA) |
| `npm run preview` | Serve the production build at http://localhost:4173 — **use this to test offline/PWA** |
| `npm run test:finance` | Money logic checks (allocation, balances, statements, parsing) |
| `npm run check:i18n` | Every language has every key; placeholders match; no unknown keys used in code |

Requires Node 18+. The service worker only runs in the production build (`build` + `preview`).

### Demo accounts (password `demo1234`)

Tap one on the login screen to fill the form.

| Account | Business | Role |
|---|---|---|
| owner@alnoor.demo | Al-Noor General Store (AFN, Basic plan) | Owner |
| manager@alnoor.demo | Al-Noor General Store | Manager |
| employee@alnoor.demo | Al-Noor General Store | Employee |
| sara@bright.demo | Bright Electronics (USD, Free plan) | Owner |

`owner@alnoor.demo` also belongs to Bright Electronics as a **Manager**, so you can try business switching
(sidebar → business name) and see that data, plan and permissions change per business.
**Settings → Reset demo data** restores everything.

### Suggested demo script for shop owners (5 minutes)
1. Dashboard → who owes you, who is overdue.
2. Customers → open one → **Take payment** → *Pay full balance* → Save → View receipt → Print/WhatsApp.
3. Switch language to Arabic / Dari / Pashto (layout flips to RTL instantly).
4. **Sync center → Simulate offline**, record a credit and a payment, watch the "waiting to sync" state, switch back online.
5. Sync center → arm *Lose the server reply* then reconnect → see a failed sync, tap Retry, **no duplicate is created**.

---

## Project structure

```
src/
  config/appConfig.js     ← EVERYTHING configurable: plans, roles/permissions, currencies, timings
  db/index.js             ← IndexedDB schema + tenant-scoped queries
  services/
    ledgerService.js      ← the ONLY writer of financial records (append-only, void instead of delete)
    authService.js        ← mock auth, tenants, team (replace with Sanctum API)
  sync/
    syncEngine.js         ← outbox queue → server, retries, conflicts, discard
    fakeServer.js         ← SIMULATED backend (idempotency, server IDs, conflicts). Delete when real API exists
  lib/
    finance.js            ← pure money math: allocation, balances, aging, statements (unit-checked)
    validation.js         ← form rules → error codes (translated in the UI)
    dates.js, utils.js
  store/                  ← Zustand: auth/tenant, data snapshot, sync state, UI (toasts/dialogs), prefs
  i18n/
    locales/{en,ar,prs,ps}.js   ← translations
    format.js             ← numbers/money/dates (Gregorian + Solar Hijri, native digits)
    useI18n.js            ← `const { t, fmt, isRtl } = useI18n()`
  components/ui/          ← Button, Form controls, Modal, Display (Card, Badge, Stat, …), Toasts
  components/layout/      ← AppShell (sidebar + mobile bottom nav), SyncPill, switchers
  components/shared/      ← Payment/Credit/Customer dialogs, Receipt, Charts, badges, print portal
  pages/                  ← one file per screen
  mock/seed.js            ← realistic demo data for two businesses
  api/contract.js         ← the REST API the future Laravel backend should provide
scripts/                  ← check-finance.mjs, check-i18n.mjs
```

Design rules that keep the code simple: components never do money math (they call `lib/finance.js`);
only `ledgerService` writes records; balances are **never stored**, always derived from the records.

---

## Key product decisions

- **Money is stored as integers** in minor units (no floating-point errors). AFN/PKR/IRR use 0 decimals, USD/EUR 2.
- **Append-only ledger.** Entries are never edited or deleted. Mistakes are **voided** with a reason and stay visible (auditable).
- **Payments are allocated oldest-credit-first** across a customer's unpaid credits, with an optional "apply to this credit" override. Overpayment is blocked.
- **Customers are archived, not deleted**, so history and reports stay correct.
- **Roles**: Owner (everything), Manager (reports, void, archive), Employee (customers, credit, payments). Defined in `PERMISSIONS`.
- **Plans** (editable in `appConfig.js`): Free = the whole core job (30 customers, 2 users, offline, receipts, statements) so shopkeepers trust the product;
  Basic/Premium = more customers/staff + CSV export + monthly reports. Limits are enforced in the UI only.
- **Colors** (`tailwind.config.js`): pink = brand & friendly actions · orange = the one important money action and "needs attention" ·
  green = money received / settled · white & warm neutrals = 80% of the UI · debts use a warm brown-orange, not alarming red.

---

## How to customize

**Business info:** Settings page (owner) — name, logo, type, phone/address, currency, overdue threshold.
Seeded businesses are defined in `src/mock/seed.js` (`TENANTS`, `USERS`, `MEMBERS`).

**Brand colors / fonts:** `tailwind.config.js` (`brand`, `accent`, `mint`, `ink`). Fonts are bundled via `@fontsource` so they work offline.

**Plans, roles, currencies, overdue days, sync timings:** `src/config/appConfig.js`.

**App name / icons / PWA:** `vite.config.js` (manifest), `public/icons/`.

## How to add or change translations

- Edit text in `src/i18n/locales/<lang>.js`. Keys mirror `en.js`; use `{name}` placeholders.
- **Add a language:** create `locales/xx.js` (copy `en.js`), register it in `locales/index.js` (`dir: 'rtl' | 'ltr'`, `intl` tag, `nativeDigits`).
- Run `npm run check:i18n` — it reports missing/extra keys and placeholder mismatches.
- Components use `t('section.key')`; amounts/dates use `fmt.money / fmt.date / fmt.number` so digits, separators and calendars follow the language.
- **RTL** works by setting `<html dir lang>` (see `prefsStore.js`) and using Tailwind *logical* utilities (`ms-`, `ps-`, `text-start`, `border-s`, …). Directional icons use `rtl:-scale-x-100`. Charts reverse their axes in RTL.
- Dari/Pashto default to the **Solar Hijri** calendar and native digits (changeable in Settings). Stored dates are always Gregorian.
- Pashto month/weekday names are built by hand (`format.js`) because browsers lack Pashto date data. Translations were written carefully but **should be reviewed by native speakers** before launch, especially financial terms.

---

## How offline works

1. **App shell:** a Workbox service worker (via `vite-plugin-pwa`) precaches all code, fonts and icons, so the app opens with no network and is installable.
2. **Data:** every customer, credit and payment is written to **IndexedDB** first. Reads never wait for a network.
3. **Outbox:** each write also adds an operation (with a unique id) to an `outbox` store, **in the same transaction**, so a record can never exist without its queued sync (or vice-versa).
4. **Sync engine:** when online, operations are sent one at a time in order. Per operation the (simulated) server replies *applied*, *duplicate*, *conflict* or *error*.
   - applied → server id / official receipt number stored, record marked **synced**
   - error → marked **failed**, run stops, retried automatically every 30s and on reconnect, or manually via **Retry**
   - conflict → never auto-resolved; the user chooses (Sync center)
5. **Visible state:** header pill (Online / Offline / Syncing / Sync failed / Needs review / N waiting), per-record badges, and the **Sync center** page.
6. **Idempotency:** the operation id is the idempotency key. If the server saved a payment but the reply was lost, the retry returns the stored result — **no duplicate money**.
7. **Temporary IDs:** records get client UUIDs immediately; receipts show a temporary number (`D-XXXXX`) until the server assigns the official sequential one (`R-00042`).

> Local storage alone is **not** a complete sync system: this MVP does not yet *pull* changes made on other devices. See below.

---

## What remains for backend integration

Target stack: Laravel + MySQL + Sanctum + REST + Policies/Gates. Endpoint sketch: `src/api/contract.js`.

**Security (critical — the frontend provides none):**
- Real authentication (Sanctum), hashed passwords, email verification, password reset. The mock login stores plain-text demo passwords.
- **Tenant isolation on every request:** global scope on `tenant_id`, verify membership from the authenticated user (never trust a tenant id sent by the client), authorize with Policies. Role checks in the UI are cosmetic.
- Server-side plan limits, input validation (repeat `lib/validation.js` rules), rate limiting.

**Financial integrity:**
- Compute payment **allocations, balances and receipt numbers on the server inside DB transactions**; ignore client-computed values.
- Append-only tables with `voided_at/by/reason`; full **audit log** (who, when, before/after).
- Unique index `(tenant_id, client_uuid)` for idempotent writes; sequential receipt numbers per tenant.

**Synchronization:**
- `POST /sync/operations` accepting the outbox format with `Idempotency-Key`, returning per-op status (`applied | duplicate | conflict | rejected`).
- Optimistic concurrency (`version` / `base_version`) → `409 Conflict` with the server record; the UI already resolves customer-edit conflicts.
- **Pull sync** (`GET /sync/changes?cursor=`) so devices receive each other's data, tombstones for archived/voided rows, conflict policy for credits created against an already-changed balance.
- Retire `src/sync/fakeServer.js` and the `serverLedger/serverOps` IndexedDB stores.

**Product/ops:** team invitation emails, billing + payment gateway, subscription lifecycle, notifications (overdue reminders/daily summary — preferences are saved already), logo storage, backups, background jobs, monitoring.
Search the code for `TODO(backend)` for the exact places.

**Frontend follow-ups:** swap `dataStore.load()` for TanStack Query + the API; paginate very large ledgers; calendar-aware (Solar Hijri) month grouping in reports; native-speaker review of translations; automated UI tests.

---

## Verified before handoff

Production build · finance unit checks (`npm run test:finance`) · i18n key checks · browser-tested journeys (login → payment →
receipt → statement → reports/team/plans/settings/sync) · offline reload, deep-links and recording a payment with the network off
(then reconnect + sync) · lost-reply retry with no duplicate, client/server totals identical · employee permission limits ·
all four languages on a 390px phone with no horizontal overflow · RTL layouts (sidebar, charts, forms).
