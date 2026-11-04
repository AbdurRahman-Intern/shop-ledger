// FUTURE LARAVEL REST API CONTRACT (documentation, not executed).
//
// This file is the hand-off to the backend: it lists the endpoints the frontend expects.
// The frontend currently talks to IndexedDB through src/services/*; when the API exists,
// each service function gets a matching HTTP call and IndexedDB becomes the offline cache.
//
// Conventions
//  - Auth: Laravel Sanctum bearer token. Tenant comes from the token/route, e.g. /api/t/{tenant}/...
//    and EVERY query is scoped by tenant_id on the server (global scope) and checked by a Policy.
//  - Money: integers in minor units + ISO currency code. Never floats.
//  - Dates: business dates "YYYY-MM-DD"; timestamps ISO-8601 UTC.
//  - Every write carries `client_uuid` (our local id). Unique index (tenant_id, client_uuid)
//    makes writes idempotent. The `Idempotency-Key` header repeats it for the sync endpoint.
//  - Financial rows are append-only: "void" endpoints set voided_at/voided_by/void_reason.
//
// AUTH
//   POST   /api/auth/register            {name,email,password}
//   POST   /api/auth/login               {email,password}        -> {token,user}
//   POST   /api/auth/logout
//   GET    /api/me                       -> user + memberships[{tenant,role,permissions}]
//
// TENANTS & TEAM
//   POST   /api/tenants                  create business (creator becomes owner, Free plan)
//   GET    /api/t/{tenant}/settings      PATCH same
//   GET    /api/t/{tenant}/members       POST invite  PATCH {role}  DELETE
//   POST   /api/invitations/{token}/accept
//
// LEDGER
//   GET    /api/t/{tenant}/bootstrap?since=cursor      customers, credits, payments, allocations (delta)
//   POST   /api/t/{tenant}/customers                  PATCH /customers/{id} (with base_version → 409 on conflict)
//   POST   /api/t/{tenant}/credits                    POST /credits/{id}/void
//   POST   /api/t/{tenant}/payments                   POST /payments/{id}/void
//          (server computes allocations + sequential receipt number inside a DB transaction)
//   GET    /api/t/{tenant}/customers/{id}/statement?from=&to=
//   GET    /api/t/{tenant}/reports/{outstanding|collections|credit|payments}
//
// SYNC (batch version of the above, used by the offline outbox)
//   POST   /api/t/{tenant}/sync/operations    [{op_id,type,payload,base_version}]
//          -> per operation: {op_id, status: applied|duplicate|conflict|rejected, server_id, receipt_number, server_record}
//   GET    /api/t/{tenant}/sync/changes?cursor=...   pull changes made on other devices
//
// BILLING
//   GET    /api/plans            GET/POST /api/t/{tenant}/subscription   (limits enforced on create endpoints)

export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''; // TODO(backend): set in .env
