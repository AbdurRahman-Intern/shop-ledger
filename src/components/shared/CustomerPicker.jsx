// CUSTOMER PICKER — searchable list that stays visible (no hidden dropdown), so choosing a
// customer is one tap on a phone. Search also understands Arabic/Persian letter variants.
import { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { Avatar, Money } from '../ui/Display.jsx';
import { TextInput } from '../ui/Form.jsx';
import { normalizeSearch, cx } from '../../lib/utils.js';

export default function CustomerPicker({ customers, stats, value, onChange, error, disabledWhen, autoFocus }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    const list = q ? customers.filter((c) => normalizeSearch(c.name).includes(q) || normalizeSearch(c.phone || '').includes(q)) : customers;
    // People who owe the most first — they are the most likely to be picked for a payment.
    return [...list].sort((a, b) => (stats.get(b.id)?.balance || 0) - (stats.get(a.id)?.balance || 0) || a.name.localeCompare(b.name));
  }, [customers, stats, query]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" aria-hidden />
        <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('credit.searchCustomer')} aria-label={t('credit.searchCustomer')}
          className="ps-10" invalid={!!error} autoFocus={autoFocus} />
      </div>
      <ul role="listbox" aria-label={t('credit.customer')} className="scroll-thin mt-2 max-h-52 overflow-y-auto rounded-xl border border-ink-200 bg-white">
        {filtered.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-500">{t('customers.noMatchTitle')}</li>}
        {filtered.map((c) => {
          const balance = stats.get(c.id)?.balance || 0;
          const selected = value === c.id;
          const disabled = disabledWhen?.(c, balance);
          return (
            <li key={c.id} role="option" aria-selected={selected} aria-disabled={disabled || undefined}>
              <button type="button" disabled={disabled} onClick={() => onChange(c.id)}
                className={cx('flex w-full items-center gap-3 border-b border-ink-100 px-3 py-2.5 text-start last:border-0 touch',
                  selected ? 'bg-brand-50' : 'hover:bg-ink-50', disabled && 'opacity-45')}>
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink-900">{c.name}</span>
                  {c.phone && <bdi dir="ltr" className="block truncate text-xs text-ink-500">{c.phone}</bdi>}
                </span>
                <span className="text-sm font-semibold">{balance > 0 ? <Money minor={balance} tone="debt" /> : <span className="text-xs font-medium text-mint-700">{t('status.clear')}</span>}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-1.5 text-sm text-danger-500">{error}</p>}
    </div>
  );
}
