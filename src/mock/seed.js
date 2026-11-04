// MOCK DATA / DEMO SEEDING
// Creates two independent businesses with realistic, DATE-RELATIVE history (so charts
// always look alive no matter when you open the app). Runs once, on first launch.
//
// The generator reuses the real finance helpers (allocatePayment) so the seeded
// ledger obeys exactly the same rules as data created in the app.
//
// TODO(backend): delete this whole folder when real APIs exist.

import { getDb, getMeta, setMeta, clearAllStores } from '../db/index.js';
import { allocatePayment } from '../lib/finance.js';
import { todayISO, addDays } from '../lib/dates.js';
import { APP } from '../config/appConfig.js';

// Deterministic random numbers: same demo data on every machine (mulberry32).
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n) => String(n).padStart(2, '0');

const TENANTS = [
  {
    id: 'ten_alnoor', seed: 11, name: 'Al-Noor General Store', type: 'grocery', currency: 'AFN', language: 'en',
    phone: '+93 70 555 0101', address: 'Kart-e-Char, Kabul', plan: 'basic',
    amount: { min: 150, max: 4500, step: 50 },
    descriptions: [
      'Rice 20kg and cooking oil', 'Monthly groceries', 'Flour, sugar and tea', 'Cooking oil 5L', 'Household supplies',
      'Dairy and eggs', 'Rice and beans', 'School supplies', 'Cleaning products', 'Tea, sugar, biscuits',
      'Fresh vegetables and fruit', 'Eid shopping',
    ],
    customers: [
      'Ahmad Zahir', 'Mohammad Nabi', 'Fatima Rahimi', 'Abdullah Sharifi', 'Zarghona Popal', 'Khalil Ahmadzai',
      'Najibullah Safi', 'Mariam Qaderi', 'Sultan Mohammadi', 'Rahima Stanikzai', 'Wahid Hotak', 'Shukria Amini',
      'Gul Agha Karimi', 'Bashir Noori', 'Laila Sadat', 'Farid Mangal', 'Hasina Yousufzai', 'Jawad Rezaie',
      'احمد ظاهر', 'فاطمه رحیمی', 'عبدالله شریفی', 'زرغونه پوپل', 'نجیب‌الله صافی', 'مریم قادری',
    ],
  },
  {
    id: 'ten_bright', seed: 77, name: 'Bright Electronics', type: 'electronics', currency: 'USD', language: 'en',
    phone: '+93 79 555 0202', address: 'Shahr-e-Naw, Kabul', plan: 'free',
    amount: { min: 500, max: 18000, step: 50 }, // cents
    descriptions: [
      'Phone charger and cable', 'Bluetooth headphones', 'Power bank 20000mAh', 'USB flash drive 64GB', 'LED bulbs (x10)',
      'Phone screen protector', 'Laptop mouse and bag', 'Batteries pack', 'Extension cable', 'Memory card 128GB',
    ],
    customers: [
      'Daud Karimi', 'Sima Ahmadi', 'Naveed Rasooli', 'Parwana Hakimi', 'Idris Waziri', 'Mina Faizi', 'Tariq Zadran',
      'Roya Naseri', 'Samiullah Aryan', 'Nasrin Bahar', 'Omid Shinwari', 'Zainab Tahiri', 'Hashmat Barakzai',
      'Shabnam Delawar', 'Latif Wardak', 'Mahbooba Sultani', 'Yaqoob Sahak', 'Anisa Kohistani',
    ],
  },
];

const USERS = [
  { id: 'usr_ahmad', name: 'Ahmad Karimi', email: 'owner@alnoor.demo' },
  { id: 'usr_mariam', name: 'Mariam Noori', email: 'manager@alnoor.demo' },
  { id: 'usr_hamid', name: 'Hamid Rahimi', email: 'employee@alnoor.demo' },
  { id: 'usr_sara', name: 'Sara Ahmadi', email: 'sara@bright.demo' },
];

const MEMBERS = [
  { id: 'mem_1', tenantId: 'ten_alnoor', userId: 'usr_ahmad', role: 'owner' },
  { id: 'mem_2', tenantId: 'ten_alnoor', userId: 'usr_mariam', role: 'manager' },
  { id: 'mem_3', tenantId: 'ten_alnoor', userId: 'usr_hamid', role: 'employee' },
  { id: 'mem_4', tenantId: 'ten_bright', userId: 'usr_sara', role: 'owner' },
  // Same person, different role per business — shows multi-tenant switching with role changes.
  { id: 'mem_5', tenantId: 'ten_bright', userId: 'usr_ahmad', role: 'manager' },
];

const roundTo = (value, step) => Math.max(step, Math.round(value / step) * step);

// Builds one tenant's customers, credits, payments and allocations.
function buildTenantLedger(cfg, today) {
  const rand = rng(cfg.seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const staff = MEMBERS.filter((m) => m.tenantId === cfg.id).map((m) => m.userId);
  const stamp = (date) => `${date}T${pad(between(8, 18))}:${pad(between(0, 59))}:00.000Z`;

  const customers = [], credits = [], payments = [], allocations = [];
  let n = 0;

  cfg.customers.forEach((name, i) => {
    const id = `${cfg.id}_cus_${i + 1}`;
    const profile = pick(['good', 'good', 'regular', 'regular', 'regular', 'slow', 'slow', 'new', 'empty']);
    const firstDay = profile === 'slow' ? between(45, 110) : profile === 'new' ? between(1, 9) : between(30, 120);
    customers.push({
      id, tenantId: cfg.id, name,
      phone: `+93 7${between(0, 9)} ${between(100, 999)} ${between(1000, 9999)}`,
      address: pick(['Kabul', 'Kart-e-Parwan', 'Taimani', 'Wazir Akbar Khan', 'Khair Khana', 'Dasht-e-Barchi']),
      note: i % 7 === 0 ? 'Pays at the end of the month' : '',
      archived: false,
      createdAt: stamp(addDays(today, -(firstDay + 3))), updatedAt: stamp(addDays(today, -(firstDay + 3))),
      createdBy: pick(staff),
      syncStatus: 'synced', serverId: `srv_${cfg.id}_cus_${i + 1}`, serverVersion: 1,
    });
    if (profile === 'empty') return;

    // Plan the events, then replay them in date order so every payment is valid.
    const creditCount = profile === 'new' ? between(1, 2) : profile === 'slow' ? between(2, 4) : between(3, 6);
    const events = [];
    for (let k = 0; k < creditCount; k++) {
      const date = addDays(today, -Math.max(profile === 'new' ? 0 : 1, firstDay - Math.floor((k * firstDay) / creditCount) - between(0, 4)));
      events.push({ type: 'credit', date, amount: roundTo(cfg.amount.min + rand() * (cfg.amount.max - cfg.amount.min), cfg.amount.step) });
    }
    const first = events.map((e) => e.date).sort()[0];
    const span = Math.max(2, Math.min(firstDay, 100));
    if (profile === 'good') {
      events.forEach((e) => events.push({ type: 'payment', date: addDays(e.date, between(1, 12)), full: true }));
    } else if (profile === 'regular') {
      for (let k = 0; k < between(2, 3); k++) events.push({ type: 'payment', date: addDays(first, between(3, span)), fraction: 0.25 + rand() * 0.35 });
    } else if (profile === 'slow' && rand() > 0.4) {
      events.push({ type: 'payment', date: addDays(first, between(5, Math.max(6, span - 10))), fraction: 0.15 + rand() * 0.2 });
    }
    events.sort((a, b) => a.date.localeCompare(b.date) || (a.type === 'credit' ? -1 : 1));

    const open = []; // credits still owing for this customer
    for (const ev of events) {
      if (ev.date > today) continue;
      if (ev.type === 'credit') {
        const credit = {
          id: `${cfg.id}_crd_${++n}`, tenantId: cfg.id, customerId: id, amount: ev.amount,
          description: pick(cfg.descriptions), date: ev.date, createdAt: stamp(ev.date), createdBy: pick(staff),
          syncStatus: 'synced', serverId: `srv_${cfg.id}_crd_${n}`, voidedAt: null, voidReason: null,
        };
        credits.push(credit);
        open.push({ ...credit, remaining: credit.amount });
        continue;
      }
      const outstanding = open.reduce((s, c) => s + c.remaining, 0);
      if (outstanding <= 0) continue;
      const total = credits.filter((c) => c.customerId === id).reduce((s, c) => s + c.amount, 0);
      const amount = ev.full ? outstanding : Math.min(outstanding, roundTo(total * ev.fraction, cfg.amount.step));
      const { allocations: parts } = allocatePayment(amount, open);
      const payment = {
        id: `${cfg.id}_pay_${++n}`, tenantId: cfg.id, customerId: id, amount, date: ev.date,
        method: pick(['cash', 'cash', 'cash', 'mobile', 'bank']), note: '',
        createdAt: stamp(ev.date), createdBy: pick(staff),
        number: null, serverNumber: null, syncStatus: 'synced', serverId: `srv_${cfg.id}_pay_${n}`,
        voidedAt: null, voidReason: null,
      };
      payments.push(payment);
      for (const part of parts) {
        const target = open.find((c) => c.id === part.creditId);
        target.remaining -= part.amount;
        allocations.push({ id: `${cfg.id}_alc_${++n}`, tenantId: cfg.id, paymentId: payment.id, creditId: part.creditId, amount: part.amount });
      }
    }
  });

  // Sequential receipt numbers in chronological order (the server's job in production).
  payments.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)).forEach((p, idx) => {
    p.serverNumber = `R-${String(idx + 1).padStart(5, '0')}`;
    p.number = p.serverNumber;
  });

  // Realistic corrections so the "void" feature has something to show:
  const voidablePayment = payments.find((p) => p.amount > cfg.amount.step * 4);
  if (voidablePayment) {
    voidablePayment.voidedAt = stamp(voidablePayment.date);
    voidablePayment.voidReason = 'Entered by mistake';
  }
  // Archive two customers who owe nothing (history must remain intact).
  const ledgerBalance = (cid) =>
    credits.filter((c) => c.customerId === cid && !c.voidedAt).reduce((s, c) => s + c.amount, 0) -
    payments.filter((p) => p.customerId === cid && !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  customers.filter((c) => ledgerBalance(c.id) === 0 && credits.some((k) => k.customerId === c.id)).slice(0, 2).forEach((c) => { c.archived = true; });

  return { customers, credits, payments, allocations };
}

// Seed the SIMULATED server so it agrees with what the client already has.
function buildServerState(cfg, ledger) {
  const rows = ledger.customers.map((c) => ({
    id: `cus:${c.id}`, kind: 'customer', tenantId: cfg.id, version: 1,
    credits: ledger.credits.filter((k) => k.customerId === c.id && !k.voidedAt).reduce((s, k) => s + k.amount, 0),
    payments: ledger.payments.filter((p) => p.customerId === c.id && !p.voidedAt).reduce((s, p) => s + p.amount, 0),
    snapshot: { name: c.name, phone: c.phone, address: c.address, note: c.note, archived: c.archived },
  }));
  rows.push({ id: `seq:${cfg.id}:receipt`, kind: 'seq', value: ledger.payments.length });
  rows.push({ id: `seq:${cfg.id}:server`, kind: 'seq', value: 100000 });
  return rows;
}

export async function seedDemoData() {
  await clearAllStores();
  const today = todayISO();
  const db = await getDb();
  const names = ['users', 'tenants', 'members', 'customers', 'credits', 'payments', 'allocations', 'serverLedger'];
  const tx = db.transaction(names, 'readwrite');
  const put = (store, rows) => rows.forEach((r) => tx.objectStore(store).put(r));

  put('users', USERS.map((u) => ({ ...u, password: APP.demoPassword, createdAt: `${today}T08:00:00.000Z` })));
  put('members', MEMBERS.map((m) => ({ ...m, status: 'active', invitedAt: null, joinedAt: `${addDays(today, -200)}T08:00:00.000Z` })));

  for (const cfg of TENANTS) {
    const ledger = buildTenantLedger(cfg, today);
    put('tenants', [{
      id: cfg.id, name: cfg.name, type: cfg.type, currency: cfg.currency, language: cfg.language,
      dateFormat: 'gregorian', digits: 'latn', phone: cfg.phone, address: cfg.address, logo: null,
      overdueDays: APP.defaultOverdueDays,
      notifications: { overdueReminders: true, dailySummary: false, syncAlerts: true },
      subscription: { planId: cfg.plan, status: 'active', startedAt: addDays(today, -200), renewsAt: addDays(today, 22) },
      createdAt: `${addDays(today, -200)}T08:00:00.000Z`,
    }]);
    put('customers', ledger.customers);
    put('credits', ledger.credits);
    put('payments', ledger.payments);
    put('allocations', ledger.allocations);
    put('serverLedger', buildServerState(cfg, ledger));
  }
  await tx.done;
  await setMeta('seeded', true);
}

export async function seedIfEmpty() {
  if (await getMeta('seeded')) return;
  await seedDemoData();
}
