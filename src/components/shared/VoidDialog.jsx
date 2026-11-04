// VOID DIALOG — financial records are never deleted. Voiding keeps the entry visible in the
// history (marked "voided") with a reason, which is what makes the ledger auditable.
import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, TextInput } from '../ui/Form.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { useErrorText } from '../../hooks/useMisc.js';

export default function VoidDialog({ open, onClose, title, text, onConfirm }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try { await onConfirm(reason.trim()); setReason(''); onClose(); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={submit} loading={busy}>{t('common.confirm')}</Button>
      </>}>
      <p className="mb-4 text-[15px] leading-relaxed text-ink-600">{text}</p>
      <Field label={t('common.reason')} optional optionalText={t('common.optional')}>
        {(p) => <TextInput {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('payment.reasonPh')} maxLength={120} />}
      </Field>
      {error && <p role="alert" className="mt-3 text-sm text-danger-500">{error}</p>}
    </Modal>
  );
}
