// Status badges used in lists: payment status of a credit, and per-record sync status.
import { CheckCircle2, Clock3, Loader2, AlertTriangle, XCircle, Ban, GitMerge } from 'lucide-react';
import { Badge } from '../ui/Display.jsx';
import { useI18n } from '../../i18n/useI18n.js';

// Payment status of a credit sale: paid (green) / partial (orange) / unpaid (pink-neutral) / void.
export function CreditStatusBadge({ status }) {
  const { t } = useI18n();
  const map = {
    paid: { tone: 'success', icon: CheckCircle2 }, partial: { tone: 'warning', icon: Clock3 },
    unpaid: { tone: 'brand', icon: Clock3 }, void: { tone: 'neutral', icon: Ban },
  };
  const m = map[status] || map.unpaid;
  return <Badge tone={m.tone} icon={m.icon}>{t(`status.${status}`)}</Badge>;
}

// Per-record SYNC status. Quiet for "synced" (the normal state), loud for anything needing attention.
// `compact` shows only an icon (used inside dense rows) with an accessible label.
export function SyncBadge({ status = 'synced', compact = false }) {
  const { t } = useI18n();
  const map = {
    synced: { tone: 'success', icon: CheckCircle2, label: t('sync.synced') },
    pending: { tone: 'warning', icon: Clock3, label: t('sync.waiting') },
    syncing: { tone: 'info', icon: Loader2, label: t('sync.retrying'), spin: true },
    failed: { tone: 'danger', icon: XCircle, label: t('sync.failedShort') },
    conflict: { tone: 'warning', icon: GitMerge, label: t('sync.conflictShort') },
    discarded: { tone: 'neutral', icon: Ban, label: t('sync.discarded') },
  };
  const m = map[status] || map.synced;
  const Icon = m.icon;
  if (compact) {
    const color = { success: 'text-mint-600', warning: 'text-accent-600', info: 'text-info-600', danger: 'text-danger-500', neutral: 'text-ink-400' }[m.tone];
    return <span title={m.label} role="img" aria-label={m.label} className={color}><Icon className={`h-4 w-4 ${m.spin ? 'animate-spin' : ''}`} /></span>;
  }
  return <Badge tone={m.tone}><Icon className={`h-3 w-3 ${m.spin ? 'animate-spin' : ''}`} aria-hidden />{m.label}</Badge>;
}

export { AlertTriangle };
