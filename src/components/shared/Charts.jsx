// CHARTS (Recharts). Colors carry meaning, consistent across the whole product:
//   orange = credit given (money that left with the customer)   green = money collected
//   aging: light → dark orange → red as debt gets older
// RTL: time flows right-to-left in RTL languages, so the X axis is reversed and the Y axis
// moves to the other side. Tooltips format money with the business currency/locale.
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useI18n } from '../../i18n/useI18n.js';

export const CHART_COLORS = { credit: '#F58220', collected: '#16A34A', grid: '#E9E4E7', axis: '#7A7077' };
const AGING_COLORS = ['#FDBA74', '#FB9A45', '#DB6410', '#B91C1C'];

function MoneyTooltip({ active, payload, label, fmt, names }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3 text-sm shadow-pop">
      <p className="mb-1 font-semibold text-ink-900">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-ink-700">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color || p.fill }} aria-hidden />
          {names[p.dataKey] || p.name}: <bdi className="font-semibold tabular">{fmt.money(p.value)}</bdi>
        </p>
      ))}
    </div>
  );
}

// Credit vs collections over time. `variant`: 'area' for daily trend, 'bar' for monthly.
export function TrendChart({ data, variant = 'area', height = 260 }) {
  const { t, fmt, isRtl, decimals } = useI18n();
  const names = { credit: t('dashboard.credit'), collected: t('dashboard.collections') };
  const scale = 10 ** decimals;
  const common = {
    data: data.map((d) => ({ ...d, credit: d.credit / scale, collected: d.collected / scale })),
    margin: { top: 8, right: 4, left: 4, bottom: 0 },
  };
  // Tooltip receives major units; convert back to minor for the shared formatter.
  const tip = <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={(p) => <MoneyTooltip {...p} names={names} fmt={{ money: (v) => fmt.money(Math.round(v * scale)) }} />} />;
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
      <XAxis dataKey="label" reversed={isRtl} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
      <YAxis orientation={isRtl ? 'right' : 'left'} tickLine={false} axisLine={false} width={44} tick={{ fill: CHART_COLORS.axis, fontSize: 12 }} tickFormatter={(v) => fmt.compact(v)} />
      {tip}
    </>
  );
  return (
    <div role="img" aria-label={`${names.credit} / ${names.collected}`} style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        {variant === 'bar' ? (
          <BarChart {...common} barGap={4}>{axes}
            <Bar dataKey="credit" fill={CHART_COLORS.credit} radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="collected" fill={CHART_COLORS.collected} radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        ) : (
          <AreaChart {...common}>{axes}
            <Area type="monotone" dataKey="credit" stroke={CHART_COLORS.credit} fill={CHART_COLORS.credit} fillOpacity={0.12} strokeWidth={2} />
            <Area type="monotone" dataKey="collected" stroke={CHART_COLORS.collected} fill={CHART_COLORS.collected} fillOpacity={0.14} strokeWidth={2} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// Single-series bars (collections per day/month, credit per month).
export function SimpleBars({ data, dataKey, color = CHART_COLORS.collected, name, height = 240 }) {
  const { fmt, isRtl, decimals } = useI18n();
  const scale = 10 ** decimals;
  const rows = data.map((d) => ({ ...d, [dataKey]: d[dataKey] / scale }));
  return (
    <div role="img" aria-label={name} style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
          <XAxis dataKey="label" reversed={isRtl} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 12 }} interval="preserveStartEnd" minTickGap={20} />
          <YAxis orientation={isRtl ? 'right' : 'left'} tickLine={false} axisLine={false} width={44} tick={{ fill: CHART_COLORS.axis, fontSize: 12 }} tickFormatter={(v) => fmt.compact(v)} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={(p) => <MoneyTooltip {...p} names={{ [dataKey]: name }} fmt={{ money: (v) => fmt.money(Math.round(v * scale)) }} />} />
          <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Debt by age: plain HTML bars (not Recharts) so labels and bars are natively RTL-correct and
// every amount is written next to its bar — no legend to decode, readable by screen readers.
export function AgingChart({ buckets }) {
  const { t, fmt } = useI18n();
  const max = Math.max(...buckets.map((b) => b.amount), 1);
  return (
    <ul aria-label={t('dashboard.aging')} className="space-y-3.5 py-2">
      {buckets.map((b, i) => (
        <li key={b.key} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[7.5rem_1fr]">
          <span className="text-sm text-ink-700">{t(`aging.${b.key}`)}</span>
          <div className="flex items-center gap-3">
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-ink-100" aria-hidden>
              <div className="h-full rounded-md transition-all" style={{ width: `${Math.max(b.amount ? 3 : 0, (b.amount / max) * 100)}%`, background: AGING_COLORS[i] }} />
            </div>
            <span className="w-24 shrink-0 text-end text-sm font-semibold tabular"><bdi>{b.amount ? fmt.money(b.amount) : '—'}</bdi></span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChartLegend() {
  const { t } = useI18n();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.credit }} aria-hidden />{t('dashboard.credit')}</li>
      <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS.collected }} aria-hidden />{t('dashboard.collections')}</li>
    </ul>
  );
}
