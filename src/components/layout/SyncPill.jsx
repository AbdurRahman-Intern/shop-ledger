// SYNC PILL — always-visible connection + synchronization status.
// Priority (most urgent first): offline → syncing → failed → needs review → waiting → online.
// Clicking opens the Sync center where individual records can be inspected and retried.
import { Link } from 'react-router-dom';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CloudUpload, GitMerge } from 'lucide-react';
import { useSyncStore } from '../../store/syncStore.js';
import { useDataStore } from '../../store/dataStore.js';
import { useI18n } from '../../i18n/useI18n.js';
import { cx } from '../../lib/utils.js';

export function useSyncSummary() {
  const outbox = useDataStore((s) => s.outbox);
  const syncing = useSyncStore((s) => s.syncing);
  const online = useSyncStore((s) => s.browserOnline && !s.simulateOffline);
  const lastRunFailed = useSyncStore((s) => s.lastRunFailed);
  const failed = outbox.filter((o) => o.status === 'failed').length;
  const conflicts = outbox.filter((o) => o.status === 'conflict').length;
  const pending = outbox.length;
  let state = 'online';
  if (!online) state = 'offline';
  else if (syncing) state = 'syncing';
  else if (failed || lastRunFailed) state = 'failed';
  else if (conflicts) state = 'conflict';
  else if (pending) state = 'pending';
  return { state, pending, failed, conflicts, online };
}

export default function SyncPill({ className }) {
  const { t } = useI18n();
  const { state, pending } = useSyncSummary();

  const map = {
    offline: { icon: WifiOff, cls: 'bg-ink-800 text-white', label: t('sync.offline') + (pending ? ` · ${pending}` : '') },
    syncing: { icon: RefreshCw, cls: 'bg-info-100 text-info-600', label: t('sync.syncing'), spin: true },
    failed: { icon: AlertTriangle, cls: 'bg-danger-100 text-danger-600', label: t('sync.failed') },
    conflict: { icon: GitMerge, cls: 'bg-accent-100 text-accent-700', label: t('sync.conflict') },
    pending: { icon: CloudUpload, cls: 'bg-accent-100 text-accent-700', label: pending === 1 ? t('sync.pendingOne') : t('sync.pending', { count: pending }) },
    online: { icon: Wifi, cls: 'bg-mint-100 text-mint-700', label: t('sync.online') },
  }[state];
  const Icon = map.icon;

  return (
    <Link to="/sync" aria-live="polite" title={t('nav.sync')}
      className={cx('touch inline-flex h-10 max-w-[11rem] items-center gap-1.5 rounded-full px-3 text-xs font-semibold sm:max-w-none sm:text-sm', map.cls, className)}>
      <Icon className={cx('h-4 w-4 shrink-0', map.spin && 'animate-spin')} aria-hidden />
      <span className="truncate">{map.label}</span>
    </Link>
  );
}
