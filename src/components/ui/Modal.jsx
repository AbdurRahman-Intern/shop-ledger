// MODAL — accessible dialog. A bottom sheet on phones, a centered card on larger screens.
// Accessibility: role="dialog" + aria-modal, labelled by its title, Esc closes, focus moves into
// the dialog on open and returns to the trigger on close, Tab is kept inside, page scroll is locked.
import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/utils.js';
import Button from './Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';

// Stack of open dialogs: Escape closes only the top-most one, wherever keyboard focus is.
const openStack = [];
const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', dismissable = true }) {
  const { t } = useI18n();
  const panelRef = useRef(null);
  const titleId = useId();
  const lastFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocused.current = document.activeElement;
    const entry = { close: dismissable ? onClose : null };
    openStack.push(entry);
    const onDocKey = (e) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === entry && entry.close) { e.stopPropagation(); entry.close(); }
    };
    document.addEventListener('keydown', onDocKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field (not the close button) so typing can start immediately.
    const t0 = setTimeout(() => {
      const el = panelRef.current?.querySelector('input:not([type=hidden]),select,textarea') || panelRef.current?.querySelector(FOCUSABLE);
      el?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onDocKey);
      openStack.splice(openStack.indexOf(entry), 1);
      clearTimeout(t0);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-3xl' };

  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <div className="anim-fade absolute inset-0 bg-ink-900/50" onClick={dismissable ? onClose : undefined} aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={cx('anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-2xl', widths[size])}>
        <header className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          {dismissable && (
            <button type="button" onClick={onClose} aria-label={t('common.close')} className="-me-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100">
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="pb-safe flex flex-col-reverse gap-2 border-t border-ink-100 px-5 py-3 sm:flex-row sm:justify-end">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

// Confirmation for sensitive actions (void, archive, remove, reset, logout).
export function ConfirmDialog({ open, onClose, onConfirm, title, text, confirmLabel, danger = false, loading = false, children }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel || t('common.confirm')}</Button>
      </>}>
      {text && <p className="text-[15px] leading-relaxed text-ink-600">{text}</p>}
      {children}
    </Modal>
  );
}
