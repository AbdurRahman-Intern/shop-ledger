// PAYMENT RECEIPT — preview, print and share.
// The same <ReceiptDocument/> is shown in the dialog and rendered (hidden) for printing.
import { Printer, Share2, MessageCircle, Copy, CloudOff } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Money } from '../ui/Display.jsx';
import PrintPortal from './PrintPortal.jsx';
import BusinessMark from './BusinessMark.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { useUiStore } from '../../store/uiStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { useLedger } from '../../hooks/useLedger.js';
import { buildStatement } from '../../lib/finance.js';
import { getUser } from '../../services/authService.js';
import { useEffect, useState } from 'react';

// Everything needed to describe one payment, computed from the ledger.
export function useReceiptData(paymentId) {
  const { data, customerById } = useLedger();
  const payment = data.payments.find((p) => p.id === paymentId);
  if (!payment) return null;
  const customer = customerById.get(payment.customerId);
  const creditsById = new Map(data.credits.map((c) => [c.id, c]));
  const applied = data.allocations.filter((a) => a.paymentId === payment.id).map((a) => ({ ...a, credit: creditsById.get(a.creditId) }));
  // Balance right after this payment = the running balance on its statement line.
  const statement = buildStatement(payment.customerId, data, { from: '0000-01-01', to: '9999-12-31' });
  const line = statement.lines.find((l) => l.id === payment.id);
  return { payment, customer, applied, balanceAfter: line ? line.balance : statement.closingBalance };
}

export function ReceiptDocument({ info, tenant, receivedBy }) {
  const { t, fmt } = useI18n();
  const { payment, customer, applied, balanceAfter } = info;
  const number = payment.serverNumber || payment.number;
  const Row = ({ label, children }) => (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink-200 py-2.5 text-[15px]">
      <span className="text-ink-500">{label}</span><span className="text-end font-medium text-ink-900">{children}</span>
    </div>
  );
  return (
    <article className="print-area relative mx-auto w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 text-ink-900">
      {payment.voidedAt && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-12 rounded-xl border-4 border-danger-500/60 px-6 py-2 text-5xl font-black text-danger-500/60">{t('receipt.voidedStamp')}</span>
        </div>
      )}
      <BusinessMark tenant={tenant} />
      <h2 className="mt-5 text-center text-sm font-bold uppercase tracking-wide text-ink-500">{t('receipt.title')}</h2>
      <div className="my-4 rounded-2xl bg-mint-50 py-5 text-center">
        <p className="text-sm text-mint-700">{t('receipt.amountReceived')}</p>
        <Money minor={payment.amount} className="text-3xl font-extrabold text-mint-700" />
      </div>
      <Row label={t('receipt.number')}><bdi dir="ltr">{number}</bdi></Row>
      <Row label={t('receipt.receivedFrom')}>{customer?.name}</Row>
      <Row label={t('receipt.paymentDate')}>{fmt.date(payment.date)}</Row>
      <Row label={t('receipt.method')}>{t(`methods.${payment.method}`)}</Row>
      {receivedBy && <Row label={t('receipt.receivedBy')}>{receivedBy}</Row>}
      {applied.length > 0 && (
        <div className="border-b border-dashed border-ink-200 py-2.5 text-[15px]">
          <p className="mb-1 text-ink-500">{t('receipt.appliedTo')}</p>
          <ul className="space-y-1">
            {applied.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{a.credit?.description || t('receipt.creditOf', { date: fmt.date(a.credit?.date, 'short') })}</span>
                <Money minor={a.amount} className="shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between pt-3 text-[15px] font-bold"><span>{t('receipt.remainingBalance')}</span><Money minor={balanceAfter} tone={balanceAfter > 0 ? 'debt' : 'positive'} /></div>
      {!payment.serverNumber && <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent-50 p-2.5 text-xs text-accent-700"><CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />{t('receipt.draftNote')}</p>}
      <p className="mt-5 text-center text-sm text-ink-500">{t('receipt.thanks')}</p>
      <p className="mt-1 text-center text-[11px] text-ink-400">{t('receipt.poweredBy')}</p>
    </article>
  );
}

// Plain-text version used for WhatsApp / SMS / clipboard.
export function receiptText(t, fmt, info, tenant) {
  return t('receipt.shareText', {
    business: tenant.name, number: info.payment.serverNumber || info.payment.number, customer: info.customer?.name || '',
    amount: fmt.money(info.payment.amount), date: fmt.date(info.payment.date), balance: fmt.money(info.balanceAfter),
  });
}

export function useShare() {
  const { t } = useI18n();
  const toast = useUiStore((s) => s.toast);
  const share = async ({ title, text, phone }) => {
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); toast('success', t('common.copied')); } catch { toast('error', t('errors.UNKNOWN')); }
  };
  const whatsapp = (text, phone) => {
    const digits = (phone || '').replace(/[^\d]/g, '');
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast('success', t('common.copied')); } catch { toast('error', t('errors.UNKNOWN')); }
  };
  return { share, whatsapp, copy };
}

export default function ReceiptModal() {
  const { t, fmt } = useI18n();
  const props = useUiStore((s) => s.modals.receipt);
  const tenant = useAuthStore((s) => s.tenant);
  const info = useReceiptData(props?.paymentId);
  const { share, whatsapp, copy } = useShare();
  const [receivedBy, setReceivedBy] = useState('');

  useEffect(() => {
    if (info?.payment.createdBy) getUser(info.payment.createdBy).then((u) => setReceivedBy(u?.name || ''));
  }, [info?.payment.createdBy]);

  if (!props || !info) return null;
  const close = () => useUiStore.getState().closeModal('receipt');
  const text = receiptText(t, fmt, info, tenant);
  const number = info.payment.serverNumber || info.payment.number;

  return (
    <>
      <Modal open onClose={close} title={t('receipt.preview')} subtitle={t('payment.receiptNumber', { number })} size="md"
        footer={<>
          <Button variant="secondary" icon={Copy} onClick={() => copy(text)}>{t('receipt.copyText')}</Button>
          <Button variant="secondary" icon={MessageCircle} onClick={() => whatsapp(text, info.customer?.phone)}>{t('receipt.shareWhatsapp')}</Button>
          <Button variant="secondary" icon={Share2} onClick={() => share({ title: t('receipt.shareTitle', { number }), text })}>{t('common.share')}</Button>
          <Button icon={Printer} onClick={() => window.print()}>{t('common.print')}</Button>
        </>}>
        <ReceiptDocument info={info} tenant={tenant} receivedBy={receivedBy} />
      </Modal>
      <PrintPortal><ReceiptDocument info={info} tenant={tenant} receivedBy={receivedBy} /></PrintPortal>
    </>
  );
}
