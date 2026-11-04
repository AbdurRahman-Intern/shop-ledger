// FORM CONTROLS
// Every control is wired to a visible <label> and shows its error text (not just a red border)
// with aria-invalid / aria-describedby so screen readers announce problems.
import { useId, forwardRef } from 'react';
import { cx } from '../../lib/utils.js';

const base =
  'w-full rounded-xl border bg-white px-3.5 min-h-[46px] text-ink-900 placeholder:text-ink-400 transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-ink-100 disabled:text-ink-500 ';

// Wraps a control with label, hint and error. `children` is a render function receiving the
// props the control must spread (id, aria-*), so ids always match.
export function Field({ label, error, hint, optional, optionalText, className, children }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink-700">
          {label}
          {optional && <span className="text-xs font-normal text-ink-400">({optionalText})</span>}
        </label>
      )}
      {children({ id, 'aria-invalid': !!error || undefined, 'aria-describedby': describedBy })}
      {error ? <p id={`${id}-err`} className="mt-1.5 text-sm text-danger-500">{error}</p>
        : hint ? <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cx(base, invalid ? 'border-danger-500' : 'border-ink-300', className)} {...rest} />;
});

export function TextArea({ invalid, className, ...rest }) {
  return <textarea rows={3} className={cx(base, 'py-2.5', invalid ? 'border-danger-500' : 'border-ink-300', className)} {...rest} />;
}

export function SelectInput({ invalid, className, children, ...rest }) {
  return (
    <select className={cx(base, 'appearance-none bg-no-repeat pe-9', invalid ? 'border-danger-500' : 'border-ink-300', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%237A7077' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundPosition: 'var(--chev-pos, right 12px center)' }}
      {...rest}>
      {children}
    </select>
  );
}

// Money field: free text (so native digits and decimals work) with the currency code beside it.
// `inputMode="decimal"` opens the numeric keypad on phones.
export function AmountInput({ currency, invalid, className, ...rest }) {
  return (
    <div className="relative">
      <TextInput inputMode="decimal" autoComplete="off" invalid={invalid} className={cx('ps-3.5 pe-16 text-lg font-semibold tabular', className)} {...rest} />
      <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-sm font-semibold text-ink-500">{currency}</span>
    </div>
  );
}

// Accessible on/off switch.
export function Switch({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[15px] font-medium text-ink-800">{label}</label>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-mint-600' : 'bg-ink-300')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'start-[22px]' : 'start-0.5')} />
      </button>
    </div>
  );
}

// Segmented control (radio group) — used for period filters, calendars, etc.
export function Segmented({ value, onChange, options, label, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex max-w-full overflow-x-auto rounded-xl bg-ink-100 p-1 scroll-thin', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('touch whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors',
            value === o.value ? 'bg-white text-ink-900 shadow-card' : 'text-ink-600 hover:text-ink-900')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
