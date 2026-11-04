// SUBSCRIPTION PLANS — comparison, usage vs. limits, and a simulated plan change (no payment gateway).
// Business model: Free covers the full core job (credit, payments, receipts, offline) so shopkeepers
// trust us with their ledger; Basic/Premium unlock growth: more customers/staff, exports, deeper reports.
// TODO(backend): Stripe/local payment gateway, invoices, server-side limit enforcement.
import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { useUiStore } from '../store/uiStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { usePermission, useTitle } from '../hooks/useMisc.js';
import { Card, CardHeader, PageHeader, Badge, ProgressBar } from '../components/ui/Display.jsx';
import Button from '../components/ui/Button.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import * as auth from '../services/authService.js';
import { PLANS } from '../config/appConfig.js';
import { cx } from '../lib/utils.js';

export default function Plans() {
  const { t, fmt } = useI18n();
  useTitle(t('nav.plans'));
  const tenant = useAuthStore((s) => s.tenant);
  const updateBusiness = useAuthStore((s) => s.updateBusiness);
  const toast = useUiStore((s) => s.toast);
  const canBill = usePermission('billing.manage');
  const { data } = useLedger();
  const [target, setTarget] = useState(null);
  const [members, setMembers] = useState(null);

  const current = tenant.subscription.planId;
  const activeCustomers = data.customers.filter((c) => !c.archived).length;
  // Team size for usage bars (loaded lazily from the auth service).
  if (members === null) auth.listTeam(tenant.id).then((r) => setMembers(r.length));

  const limitOf = (planId, key) => PLANS[planId].limits[key];
  // Block downgrades that would leave the business over the smaller plan's limits.
  const blocker = (planId) => {
    const c = limitOf(planId, 'customers'); const m = limitOf(planId, 'members');
    if (c !== null && activeCustomers > c) return t('plans.tooManyCustomers', { count: fmt.number(activeCustomers) });
    if (members !== null && members > m) return t('plans.tooManyMembers', { count: fmt.number(members) });
    return null;
  };
  const confirm = async () => {
    await updateBusiness({ subscription: { ...tenant.subscription, planId: target } });
    toast('success', t('plans.changed', { plan: t(`plans.${target}`) }));
    setTarget(null);
  };

  const features = [
    ['featOffline', () => true], ['featReceipts', () => true], ['featLanguages', () => true],
    ['featCsv', (p) => p.features.csvExport], ['featReports', (p) => p.features.advancedReports],
  ];
  const usage = [
    ['usageCustomers', activeCustomers, limitOf(current, 'customers')],
    ['usageMembers', members || 0, limitOf(current, 'members')],
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('plans.title')} subtitle={t('plans.subtitle')} />

      <Card>
        <CardHeader title={t('plans.usage')} subtitle={`${t('plans.current')}: ${t(`plans.${current}`)} · ${t('plans.renews', { date: fmt.date(tenant.subscription.renewsAt) })}`} />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          {usage.map(([k, used, limit]) => (
            <div key={k}>
              <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{t(`plans.${k}`)}</span><span className="text-ink-600">{fmt.number(used)} / {limit === null ? t('plans.unlimited') : fmt.number(limit)}</span></div>
              <ProgressBar value={used} max={limit || Math.max(used, 1)} tone={limit !== null && used / limit >= 0.8 ? 'warning' : 'success'} label={t(`plans.${k}`)} />
              {limit !== null && used >= limit && <p className="mt-1 text-sm text-accent-700">{t('plans.atLimit')}</p>}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.values(PLANS).map((p) => {
          const isCurrent = p.id === current;
          const isUpgrade = p.priceUSD > PLANS[current].priceUSD;
          const block = !isCurrent && !isUpgrade ? blocker(p.id) : null;
          return (
            <Card key={p.id} className={cx('relative flex flex-col p-6', p.highlight && 'border-brand-400 ring-1 ring-brand-300', isCurrent && 'bg-brand-50/40')}>
              {p.highlight && <Badge tone="brand" className="absolute -top-3 start-6">{t('plans.popular')}</Badge>}
              <h2 className="text-lg font-bold">{t(`plans.${p.id}`)}</h2>
              <p className="mt-2 flex items-baseline gap-1"><span className="text-4xl font-extrabold tracking-tight"><bdi>{fmt.money(p.priceUSD * 100, 'USD')}</bdi></span>{p.priceUSD > 0 ? <span className="text-ink-500">{t('plans.perMonth')}</span> : <span className="text-sm text-ink-500">{t('plans.forever')}</span>}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-[15px]">
                <li className="flex items-center gap-2.5"><Check className="h-4 w-4 shrink-0 text-mint-600" aria-hidden /><span><strong>{p.limits.customers === null ? t('plans.unlimited') : t('plans.upTo', { count: fmt.number(p.limits.customers) })}</strong> {t('plans.customers')}</span></li>
                <li className="flex items-center gap-2.5"><Check className="h-4 w-4 shrink-0 text-mint-600" aria-hidden /><span><strong>{t('plans.upTo', { count: fmt.number(p.limits.members) })}</strong> {t('plans.members')}</span></li>
                {features.map(([k, has]) => (
                  <li key={k} className={cx('flex items-center gap-2.5', !has(p) && 'text-ink-400')}>
                    {has(p) ? <Check className="h-4 w-4 shrink-0 text-mint-600" aria-hidden /> : <Minus className="h-4 w-4 shrink-0" aria-hidden />}{t(`plans.${k}`)}
                  </li>
                ))}
              </ul>
              {block && <p className="mt-4 rounded-lg bg-accent-50 p-2.5 text-xs text-accent-700">{block}</p>}
              <Button className="mt-5 w-full" variant={isCurrent ? 'secondary' : isUpgrade ? 'primary' : 'secondary'} disabled={isCurrent || !canBill || !!block} onClick={() => setTarget(p.id)}>
                {isCurrent ? t('plans.current') : t(isUpgrade ? 'plans.choose' : 'plans.downgrade', { plan: t(`plans.${p.id}`) })}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="text-center text-sm text-ink-500">{canBill ? t('plans.demoNote') : t('plans.ownerOnly')}</p>

      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} onConfirm={confirm} title={t('plans.changeTitle', { plan: target ? t(`plans.${target}`) : '' })} text={t('plans.changeText')} />
    </div>
  );
}
