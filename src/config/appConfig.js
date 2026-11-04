// CENTRAL CONFIGURATION
// Everything a product owner might want to tweak lives here: branding, currencies,
// plans, roles/permissions and sync-simulation timings. Keep UI components free of
// magic numbers by importing from this file.

export const APP = {
  name: 'Shop Ledger',
  tagline: 'Customer credit, simplified.',
  dbName: 'shop-ledger',
  // Bump this when the IndexedDB schema changes (see src/db/index.js `upgrade`).
  dbVersion: 1,
  // A credit older than this with money still owed is flagged "needs attention".
  defaultOverdueDays: 30,
  // Demo password shared by seeded accounts. TODO(backend): real auth via Laravel Sanctum.
  demoPassword: 'demo1234',
};

// localStorage keys (small, synchronous preferences only — financial data lives in IndexedDB).
export const STORAGE_KEYS = {
  session: 'sl_session',
  prefs: 'sl_prefs',
  simulateOffline: 'sl_simulate_offline',
};

// Amounts are stored as INTEGERS in the currency's smallest unit ("minor units")
// to avoid floating point errors (0.1 + 0.2 !== 0.3). `decimals` is how many
// digits that currency shows after the point. AFN/PKR/IRR are shown as whole
// numbers because shopkeepers there do not use fractions in daily trade.
// NOTE: because the stored scale depends on `decimals`, a business cannot change
// currency once it has financial records (enforced in Settings).
export const CURRENCIES = [
  { code: 'AFN', decimals: 0 },
  { code: 'USD', decimals: 2 },
  { code: 'EUR', decimals: 2 },
  { code: 'PKR', decimals: 0 },
  { code: 'IRR', decimals: 0 },
  { code: 'SAR', decimals: 2 },
  { code: 'AED', decimals: 2 },
  { code: 'TRY', decimals: 2 },
  { code: 'INR', decimals: 2 },
];
export const getCurrency = (code) => CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];

export const BUSINESS_TYPES = ['grocery', 'pharmacy', 'clothing', 'electronics', 'hardware', 'restaurant', 'wholesale', 'other'];

export const PAYMENT_METHODS = ['cash', 'mobile', 'bank', 'other'];

// Roles, highest privilege first.
export const ROLES = ['owner', 'manager', 'employee'];

// ROLE PERMISSIONS (frontend demonstration only).
// This only decides what the UI shows. The Laravel backend MUST enforce the same
// rules with Policies/Gates on every request — a user can edit frontend code.
export const PERMISSIONS = {
  'dashboard.financials': ['owner', 'manager'],
  'customers.edit': ['owner', 'manager', 'employee'],
  'customers.archive': ['owner', 'manager'],
  'records.void': ['owner', 'manager'],
  'reports.view': ['owner', 'manager'],
  'team.view': ['owner', 'manager'],
  'team.manage': ['owner'],
  'settings.manage': ['owner'],
  'billing.manage': ['owner'],
};

export const can = (role, permission) => (PERMISSIONS[permission] || []).includes(role);

// SUBSCRIPTION PLANS
// Free plan philosophy: the core job (record credit, take payments, print receipts,
// work offline) is free forever so a shopkeeper trusts us with their ledger first.
// Paid plans are justified by growth: more customers, more staff, deeper reports.
// `null` limit = unlimited. TODO(backend): enforce limits server-side on create.
export const PLANS = {
  free: {
    id: 'free', priceUSD: 0,
    limits: { customers: 30, members: 2 },
    features: { advancedReports: false, csvExport: false },
  },
  basic: {
    id: 'basic', priceUSD: 5, highlight: true,
    limits: { customers: 300, members: 5 },
    features: { advancedReports: true, csvExport: true },
  },
  premium: {
    id: 'premium', priceUSD: 12,
    limits: { customers: null, members: 15 },
    features: { advancedReports: true, csvExport: true },
  },
};

// Sync simulation timings (ms). In production these are real network calls.
export const SYNC = {
  latencyMin: 450,
  latencyMax: 900,
  autoRetryMs: 30000,
  // Warn if an identical credit sale is entered again within this window.
  duplicateWindowMs: 2 * 60 * 1000,
};
