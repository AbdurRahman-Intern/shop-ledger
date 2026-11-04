// DISPLAY PRIMITIVES: Card, Badge, Avatar, Money, EmptyState, Skeleton, Stat, PageHeader…
import { Loader2 } from 'lucide-react';
import { cx, initials, avatarTone } from '../../lib/utils.js';
import { useI18n } from '../../i18n/useI18n.js';

export function Card({ className, children, as: Tag = 'section', ...rest }) {
  return <Tag className={cx('card', className)} {...rest}>{children}</Tag>;
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-800',
  success: 'bg-mint-100 text-mint-700',
  warning: 'bg-accent-100 text-accent-700',
  danger: 'bg-danger-100 text-danger-600',
  info: 'bg-info-100 text-info-600',
};
export function Badge({ tone = 'neutral', icon: Icon, children, className }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 'md', src }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-16 w-16 text-xl' };
  if (src) return <img src={src} alt="" className={cx('shrink-0 rounded-full object-cover', sizes[size])} />;
  return (
    <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-bold', sizes[size], avatarTone(name))}>
      {initials(name)}
    </span>
  );
}

// Amounts are wrapped in <bdi> so Arabic-script digits and currency symbols keep their own
// direction inside right-to-left sentences (otherwise "-" and "؋" jump around).
export function Money({ minor, className, tone }) {
  const { fmt } = useI18n();
  const color = tone === 'debt' ? 'text-accent-700' : tone === 'positive' ? 'text-mint-700' : '';
  return <bdi className={cx('tabular whitespace-nowrap', color, className)}>{fmt.money(minor)}</bdi>;
}

export function Spinner({ className }) {
  return <Loader2 className={cx('animate-spin text-brand-600', className || 'h-5 w-5')} aria-hidden />;
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton', className)} aria-hidden />;
}

export function PageSkeleton() {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t('common.loading')} className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

// Helpful empty state: explains what this place is for and offers the next action.
export function EmptyState({ icon: Icon, title, text, action, className }) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon className="h-7 w-7" aria-hidden /></span>
      )}
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-[15px] text-ink-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, text, onRetry }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      {text && <p className="mt-2 text-ink-500">{text}</p>}
      {onRetry && <button onClick={onRetry} className="mt-4 rounded-xl border border-ink-300 px-4 py-2 font-semibold hover:bg-ink-50">{t('common.retry')}</button>}
    </div>
  );
}

// KPI tile. `tone` colors only the icon chip — numbers stay dark for trust and readability.
export function Stat({ label, value, sub, icon: Icon, tone = 'brand', className }) {
  const chip = { brand: 'bg-brand-50 text-brand-600', accent: 'bg-accent-50 text-accent-600', success: 'bg-mint-50 text-mint-600', info: 'bg-info-50 text-info-600' }[tone];
  return (
    <div className={cx('card p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {Icon && <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', chip)}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{value}</div>
      {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
    </div>
  );
}

// Thin progress bar (plan usage, collection progress). Green = healthy, orange = near limit.
export function ProgressBar({ value, max, tone = 'success', label }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = tone === 'warning' ? 'bg-accent-500' : tone === 'brand' ? 'bg-brand-500' : 'bg-mint-500';
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="h-2 overflow-hidden rounded-full bg-ink-100">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Responsive table wrapper: horizontally scrollable on phones, keeps header semantics.
export function TableWrap({ children, className }) {
  return <div className={cx('overflow-x-auto scroll-thin', className)}><table className="w-full min-w-[560px] text-start text-[15px]">{children}</table></div>;
}
export const Th = ({ children, className, align = 'start' }) => (
  <th scope="col" className={cx('whitespace-nowrap border-b border-ink-200 bg-ink-50 px-4 py-2.5 text-xs font-semibold text-ink-500', align === 'end' ? 'text-end' : 'text-start', className)}>{children}</th>
);
export const Td = ({ children, className, align = 'start' }) => (
  <td className={cx('border-b border-ink-100 px-4 py-3 align-middle', align === 'end' ? 'text-end' : 'text-start', className)}>{children}</td>
);

export function Hint({ children }) {
  // Lightweight tooltip: native title + visible-on-focus text for touch/screen readers.
  return <span title={children} className="cursor-help text-ink-400" aria-label={children}>ⓘ</span>;
}
