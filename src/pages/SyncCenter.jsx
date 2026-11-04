// SYNC CENTER — transparency for offline work: what is saved on this device, what has reached the
// server, what failed and why, and buttons to retry. Also holds the DEMO TOOLS that make the
// simulated server misbehave, so offline/error/conflict handling can be shown to shop owners.
// Financial records are never silently overwritten: conflicts always ask the user.
import { useState } from 'react';
import { RefreshCw, WifiOff, Wifi, CheckCircle2, Beaker, Info } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useSyncStore } from '../store/syncStore.js';
import { useDataStore } from '../store/dataStore.js';
import { useLedger } from '../hooks/useLedger.js';
import { useTitle } from '../hooks/useMisc.js';
import { Card, CardHeader, PageHeader, Badge, Money, EmptyState } from '../components/ui/Display.jsx';
import { Switch } from '../components/ui/Form.jsx';
import Button from '../components/ui/Button.jsx';
import Modal, { ConfirmDialog } from '../components/ui/Modal.jsx';
import { SyncBadge } from '../components/shared/Badges.jsx';
import { useSyncSummary } from '../components/layout/SyncPill.jsx';
import { runSync, retryOp, retryAllFailed, resolveCustomerConflict, discardOp } from '../sync/syncEngine.js';

export default function SyncCenter() {
  const { t, fmt } = useI18n();
  useTitle(t('nav.sync'));
  const outbox = useDataStore((s) => s.outbox);
  const { customerById } = useLedger();
  const { state, online, failed } = useSyncSummary();
  const simulateOffline = useSyncStore((s) => s.simulateOffline);
  const setSimulateOffline = useSyncStore((s) => s.setSimulateOffline);
  const syncing = useSyncStore((s) => s.syncing);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const flags = useSyncStore((s) => s.flags);
  const setFlag = useSyncStore((s) => s.setFlag);
  const [resolving, setResolving] = useState(null);
  const [discarding, setDiscarding] = useState(null);

  const ops = [...outbox].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const stateLabel = { online: t('sync.online'), offline: t('sync.offline'), syncing: t('sync.syncing'), failed: t('sync.failed'), conflict: t('sync.conflict'), pending: t('sync.online') }[state];

  const errorText = (op) => (op.lastError ? t(`sync.error.${op.lastError.code}`) : '');
  const opAmount = (op) => op.payload?.amount;

  return (
    <div className="space-y-5">
      <PageHeader title={t('sync.center.title')} subtitle={t('sync.center.subtitle')}
        actions={<>
          {failed > 0 && <Button variant="secondary" onClick={retryAllFailed}>{t('sync.retryAll')}</Button>}
          <Button icon={RefreshCw} loading={syncing} onClick={() => runSync({ reason: 'manual' })}>{t('sync.syncNow')}</Button>
        </>} />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${online ? 'bg-mint-100 text-mint-700' : 'bg-ink-800 text-white'}`}>{online ? <Wifi className="h-6 w-6" aria-hidden /> : <WifiOff className="h-6 w-6" aria-hidden />}</span>
          <div className="min-w-0 flex-1"><p className="text-sm text-ink-500">{t('sync.center.connection')}</p><p className="text-lg font-bold">{online ? t('sync.online') : t('sync.offline')} <span className="text-sm font-medium text-ink-500">· {stateLabel}</span></p>
            <p className="text-sm text-ink-500">{lastSyncAt ? t('sync.lastSync', { time: fmt.dateTime(lastSyncAt) }) : t('sync.neverSynced')}</p></div>
          <Badge tone={ops.length ? 'warning' : 'success'}>{ops.length ? t('sync.pending', { count: fmt.number(ops.length) }) : t('sync.allSaved')}</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader title={t('sync.center.queue')} subtitle={t('sync.center.how')} />
        {ops.length === 0 ? <EmptyState icon={CheckCircle2} title={t('sync.center.queueEmpty')} text={t('sync.center.queueEmptyText')} /> : (
          <ul className="mt-2 divide-y divide-ink-100 px-2 pb-2">
            {ops.map((op) => {
              const customer = customerById.get(op.customerId);
              const status = op.status === 'syncing' ? 'syncing' : op.status === 'pending' ? 'pending' : op.status;
              return (
                <li key={op.id} className="px-3 py-3.5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">{t(`sync.op.${op.type.replace('.', '_')}`)}{customer && <span className="font-normal text-ink-600">· {customer.name}</span>}</p>
                      <p className="text-sm text-ink-500">{t('sync.center.recordedAt', { time: fmt.dateTime(op.createdAt) })}{op.attempts > 0 && ` · ${t('sync.center.attempts', { count: fmt.number(op.attempts) })}`}</p>
                      {op.lastError && <p role="alert" className="mt-1.5 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{errorText(op)}{op.serverBalance != null && <> · {t('sync.center.serverBalance', { amount: fmt.money(op.serverBalance) })}</>}</p>}
                    </div>
                    {opAmount(op) != null && <Money minor={opAmount(op)} className="font-bold" />}
                    <SyncBadge status={status} />
                  </div>
                  {(op.status === 'failed' || op.status === 'conflict') && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {op.type === 'customer.update' && op.status === 'conflict' ? <Button size="sm" onClick={() => setResolving(op)}>{t('sync.center.resolveTitle')}</Button> : <Button size="sm" variant="secondary" onClick={() => retryOp(op.id)}>{t('common.retry')}</Button>}
                      {['credit.create', 'payment.create'].includes(op.type) && <Button size="sm" variant="ghost" onClick={() => setDiscarding(op)}>{t('sync.center.discard')}</Button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={t('sync.center.demoTools')} subtitle={t('sync.center.demoToolsHelp')} action={<Beaker className="h-5 w-5 text-brand-600" aria-hidden />} />
        <div className="divide-y divide-ink-100 px-5 pb-2">
          <Switch label={t('sync.center.simulateOffline')} description={t('sync.center.simulateOfflineHelp')} checked={simulateOffline} onChange={setSimulateOffline} />
          <Switch label={t('sync.center.failNext')} checked={flags.failNext} onChange={(v) => setFlag('failNext', v)} />
          <Switch label={t('sync.center.conflictNext')} checked={flags.conflictNext} onChange={(v) => setFlag('conflictNext', v)} />
          <Switch label={t('sync.center.loseResponseNext')} description={t('sync.center.loseResponseHelp')} checked={flags.loseResponseNext} onChange={(v) => setFlag('loseResponseNext', v)} />
        </div>
      </Card>

      <Card className="p-5"><p className="flex items-start gap-3 text-sm text-ink-600"><Info className="mt-0.5 h-5 w-5 shrink-0 text-info-500" aria-hidden />{t('sync.center.howText')}</p></Card>

      <Modal open={!!resolving} onClose={() => setResolving(null)} title={t('sync.center.resolveTitle')} size="sm"
        footer={<><Button variant="secondary" onClick={async () => { await resolveCustomerConflict(resolving.id, 'server'); setResolving(null); }}>{t('sync.center.keepServer')}</Button><Button onClick={async () => { const id = resolving.id; setResolving(null); await resolveCustomerConflict(id, 'mine'); }}>{t('sync.center.keepMine')}</Button></>}>
        {resolving && (
          <div className="space-y-3 text-sm">
            <p className="text-ink-600">{t('sync.error.CUSTOMER_CHANGED')}</p>
            <div className="rounded-xl border border-ink-200 p-3"><p className="mb-1 font-semibold">{t('sync.center.yourVersion')}</p>{Object.entries(resolving.payload.changes).filter(([k]) => ['name', 'phone', 'address', 'note', 'archived'].includes(k)).map(([k, v]) => <p key={k} className="text-ink-700"><span className="text-ink-400">{k}:</span> {String(v) || '—'}</p>)}</div>
            <div className="rounded-xl border border-accent-200 bg-accent-50 p-3"><p className="mb-1 font-semibold">{t('sync.center.serverVersion')}</p>{Object.entries(resolving.serverRecord?.snapshot || {}).map(([k, v]) => <p key={k} className="text-ink-700"><span className="text-ink-400">{k}:</span> {String(v) || '—'}</p>)}</div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!discarding} onClose={() => setDiscarding(null)} danger title={t('sync.center.discard')} text={t('sync.center.discardConfirm')} confirmLabel={t('sync.center.discard')}
        onConfirm={async () => { await discardOp(discarding.id); setDiscarding(null); }} />
    </div>
  );
}
