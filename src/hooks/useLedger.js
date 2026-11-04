// useLedger — derived financial data for the active business.
// Balances are NEVER stored; they are recomputed from the append-only records every time
// those records change (cheap for small shops, impossible to get out of sync).

import { useMemo } from 'react';
import { useDataStore } from '../store/dataStore.js';
import { useAuthStore } from '../store/authStore.js';
import { computeLedger } from '../lib/finance.js';
import { todayISO } from '../lib/dates.js';

export function useLedger() {
  const customers = useDataStore((s) => s.customers);
  const credits = useDataStore((s) => s.credits);
  const payments = useDataStore((s) => s.payments);
  const allocations = useDataStore((s) => s.allocations);
  const overdueDays = useAuthStore((s) => s.tenant?.overdueDays || 30);
  const today = todayISO();

  return useMemo(() => {
    const data = { customers, credits, payments, allocations };
    const ledger = computeLedger(data, { today, overdueDays });
    const customerById = new Map(customers.map((c) => [c.id, c]));
    return { data, ledger, customerById, today, overdueDays };
  }, [customers, credits, payments, allocations, overdueDays, today]);
}
