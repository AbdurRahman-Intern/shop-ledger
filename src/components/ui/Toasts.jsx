// TOAST HOST — short confirmations ("Payment saved"). Announced politely to screen readers.
// Messages may be plain strings or { key, params } so the sync engine (non-React code) can
// fire translatable toasts.
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';
import { useI18n } from '../../i18n/useI18n.js';
import { cx } from '../../lib/utils.js';

const STYLE = {
  success: { icon: CheckCircle2, cls: 'border-mint-200 bg-mint-50 text-mint-700' },
  error: { icon: XCircle, cls: 'border-danger-100 bg-danger-50 text-danger-600' },
  warning: { icon: AlertTriangle, cls: 'border-accent-200 bg-accent-50 text-accent-700' },
  info: { icon: Info, cls: 'border-info-100 bg-info-50 text-info-600' },
};

export default function ToastHost() {
  const { t } = useI18n();
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div className="no-print pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 pt-safe" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const { icon: Icon, cls } = STYLE[toast.type] || STYLE.info;
        const text = typeof toast.message === 'string' ? toast.message : t(toast.message.key, toast.message.params);
        return (
          <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'}
            className={cx('anim-toast pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-pop', cls)}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="flex-1 text-[15px] font-medium text-ink-900">{text}</p>
            {toast.action && <button onClick={() => { toast.action.onClick(); dismiss(toast.id); }} className="text-sm font-bold underline">{toast.action.label}</button>}
            <button onClick={() => dismiss(toast.id)} aria-label={t('common.close')} className="-m-1 p-1 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
