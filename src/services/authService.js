// AUTH & TENANT SERVICE (MOCK)
// Simulates accounts, businesses ("tenants") and team memberships in IndexedDB.
//
// SECURITY WARNING: passwords are stored in plain text and "login" is a local lookup.
// This exists only so the product can be demonstrated. Production uses Laravel Sanctum
// with hashed passwords, and the SERVER decides which tenant a user may access.
// TODO(backend): POST /api/auth/login, /register, GET /api/me, tenant memberships endpoint.

import { getDb } from '../db/index.js';
import { uid, AppError } from '../lib/utils.js';
import { APP, PLANS } from '../config/appConfig.js';
import { todayISO, addDays } from '../lib/dates.js';

const normEmail = (e) => e.trim().toLowerCase();
const nowISO = () => new Date().toISOString();

export async function login(email, password) {
  const db = await getDb();
  const user = await db.getFromIndex('users', 'email', normEmail(email));
  if (!user || user.password !== password) throw new AppError('INVALID_CREDENTIALS');

  // Signing in is how an invited teammate "accepts" the invitation in this demo.
  const memberships = await db.getAllFromIndex('members', 'userId', user.id);
  for (const m of memberships.filter((x) => x.status === 'invited')) {
    await db.put('members', { ...m, status: 'active', joinedAt: nowISO() });
  }
  return user;
}

export async function registerUser({ name, email, password }) {
  const db = await getDb();
  if (await db.getFromIndex('users', 'email', normEmail(email))) throw new AppError('EMAIL_TAKEN');
  const user = { id: uid('usr_'), name: name.trim(), email: normEmail(email), password, createdAt: nowISO() };
  await db.put('users', user);
  return user;
}

export async function getUser(userId) {
  return (await getDb()).get('users', userId);
}

// All businesses a user belongs to, with their role in each.
export async function listMemberships(userId) {
  const db = await getDb();
  const members = (await db.getAllFromIndex('members', 'userId', userId)).filter((m) => m.status === 'active');
  const result = [];
  for (const member of members) {
    const tenant = await db.get('tenants', member.tenantId);
    if (tenant) result.push({ member, tenant });
  }
  return result;
}

export async function getTenant(tenantId) {
  return (await getDb()).get('tenants', tenantId);
}

// Create a business and make the creator its owner. New businesses start on Free.
export async function createTenant(userId, values) {
  const db = await getDb();
  const today = todayISO();
  const tenant = {
    id: uid('ten_'), name: values.name.trim(), type: values.type || 'other',
    currency: values.currency || 'USD', language: values.language || 'en',
    dateFormat: values.dateFormat || 'gregorian', digits: values.digits || 'latn',
    phone: values.phone || '', address: values.address || '', logo: values.logo || null,
    overdueDays: APP.defaultOverdueDays,
    notifications: { overdueReminders: true, dailySummary: false, syncAlerts: true },
    subscription: { planId: 'free', status: 'active', startedAt: today, renewsAt: addDays(today, 30) },
    createdAt: nowISO(),
  };
  const member = { id: uid('mem_'), tenantId: tenant.id, userId, role: 'owner', status: 'active', invitedAt: null, joinedAt: nowISO() };
  const tx = db.transaction(['tenants', 'members', 'serverLedger'], 'readwrite');
  await tx.objectStore('tenants').put(tenant);
  await tx.objectStore('members').put(member);
  // Simulated server counters for this new business (receipt numbers, server ids).
  await tx.objectStore('serverLedger').put({ id: `seq:${tenant.id}:receipt`, kind: 'seq', value: 0 });
  await tx.objectStore('serverLedger').put({ id: `seq:${tenant.id}:server`, kind: 'seq', value: 100000 });
  await tx.done;
  return { tenant, member };
}

export async function updateTenant(tenantId, patch) {
  const db = await getDb();
  const current = await db.get('tenants', tenantId);
  if (!current) throw new AppError('NOT_FOUND');
  const updated = { ...current, ...patch };
  await db.put('tenants', updated);
  return updated;
}

// ---- Team -------------------------------------------------------------------------------

export async function listTeam(tenantId) {
  const db = await getDb();
  const members = await db.getAllFromIndex('members', 'tenantId', tenantId);
  const rows = [];
  for (const member of members) {
    const user = await db.get('users', member.userId);
    if (user) rows.push({ member, user });
  }
  return rows;
}

// Invitation flow is simulated: we create the account with a temporary password and the
// invitee becomes active the first time they sign in.
// TODO(backend): send a signed, expiring invitation e-mail and let the invitee set their password.
export async function inviteMember(tenantId, { name, email, role }) {
  const db = await getDb();
  let user = await db.getFromIndex('users', 'email', normEmail(email));
  if (!user) {
    user = { id: uid('usr_'), name: name.trim() || email, email: normEmail(email), password: APP.demoPassword, createdAt: nowISO() };
    await db.put('users', user);
  }
  const existing = (await db.getAllFromIndex('members', 'tenantId', tenantId)).find((m) => m.userId === user.id);
  if (existing) throw new AppError('ALREADY_MEMBER');
  const member = { id: uid('mem_'), tenantId, userId: user.id, role, status: 'invited', invitedAt: nowISO(), joinedAt: null };
  await db.put('members', member);
  return { member, user, temporaryPassword: APP.demoPassword };
}

export async function changeMemberRole(memberId, role) {
  const db = await getDb();
  const member = await db.get('members', memberId);
  if (!member) throw new AppError('NOT_FOUND');
  if (member.role === 'owner') {
    const owners = (await db.getAllFromIndex('members', 'tenantId', member.tenantId)).filter((m) => m.role === 'owner' && m.status === 'active');
    if (owners.length <= 1) throw new AppError('LAST_OWNER');
  }
  await db.put('members', { ...member, role });
}

export async function removeMember(memberId) {
  const db = await getDb();
  const member = await db.get('members', memberId);
  if (!member) return;
  if (member.role === 'owner') throw new AppError('LAST_OWNER');
  await db.delete('members', memberId);
}

export function planLimits(planId) {
  return PLANS[planId] || PLANS.free;
}
