// RECORD CREDIT SALE dialog — customer, amount, what was sold, date. Works offline: the record
// is written to IndexedDB immediately and queued for sync.
import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, TextInput, AmountInput } from '../ui/Form.jsx';
import { Money } from '../ui/Display.jsx';
import CustomerPicker from './CustomerPicker.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { useDataStore } from '../../store/dataStore.js';
import { useUiStore } from '../../store/uiStore.js';
import { useLedger } from '../../hooks/useLedger.js';
import { useErrorText } from '../../hooks/useMisc.js';
import { validateAmount, validateDate } from '../../lib/validation.js';
import { todayISO } from '../../lib/dates.js';
import { UserPlus } from 'lucide-react';

export default function CreditModal() {
  const { t, fmt, currency, decimals } = useI18n();
  const errorText = useErrorText();
  const props = useUiStore((s) => s.modals.credit);
  const { openModal, closeModal, toast } = useUiStore.getState();
  const addCredit = useDataStore((s) => s.addCredit);
  const { data, ledger } = useLedger();

  const [customerId, setCustomerId] = useState(null);
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (props) {
      setCustomerId(props.customerId || null); setAmountText(''); setDescription(''); setDate(todayISO());
      setErrors({}); setFormError(''); setDuplicate(false);
    }
  }, [props]);

  const activeCustomers = useMemo(() => data.customers.filter((c) => !c.archived), [data.customers]);
  const customer = data.customers.find((c) => c.id === customerId);
  const balance = customerId ? ledger.customers.get(customerId)?.balance || 0 : 0;
  const amountResult = validateAmount(amountText, decimals);

  if (!props) return null;
  const close = () => closeModal('credit');

  const submit = async (e, force = false) => {
    e?.preventDefault();
    const errs = {};
    if (!customerId) errs.customer = 'selectCustomer';
    if (amountResult.error) errs.amount = amountResult.error;
    const dateErr = validateDate(date);
    if (dateErr) errs.date = dateErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // Guard against accidental double entry (same customer, amount, date and text just saved).
    if (!force && useDataStore.getState().findRecentDuplicateCredit({ customerId, amount: amountResult.minor, date, description })) {
      setDuplicate(true); return;
    }
    setBusy(true); setFormError('');
    try {
      await addCredit({ customerId, amount: amountResult.minor, description, date });
      toast('success', t('credit.saved', { amount: fmt.money(amountResult.minor), name: customer.name }));
      close();
      props.onSaved?.();
    } catch (err) { setFormError(errorText(err)); }
    finally { setBusy(false); setDuplicate(false); }
  };

  const noCustomers = activeCustomers.length === 0;

  return (
    <Modal open onClose={close} title={t('credit.title')} subtitle={t('credit.subtitle')}
      footer={duplicate ? (
        <>
          <Button variant="secondary" onClick={() => setDuplicate(false)}>{t('common.cancel')}</Button>
          <Button onClick={(e) => submit(e, true)} loading={busy}>{t('credit.saveAnyway')}</Button>
        </>
      ) : noCustomers ? null : (
        <>
          <Button variant="secondary" onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" form="credit-form" loading={busy}>{t('credit.save')}</Button>
        </>
      )}>
      {noCustomers ? (
        <div className="py-6 text-center">
          <h3 className="font-bold">{t('credit.noCustomers')}</h3>
          <p className="mx-auto mt-1 max-w-xs text-ink-500">{t('credit.noCustomersText')}</p>
          <Button className="mt-4" icon={UserPlus} onClick={() => { close(); openModal('customer', {}); }}>{t('customers.add')}</Button>
        </div>
      ) : duplicate ? (
        <div role="alert" className="rounded-xl bg-accent-50 p-4 text-accent-700">
          <h3 className="font-bold">{t('credit.duplicateTitle')}</h3>
          <p className="mt-1 text-[15px]">{t('credit.duplicateText', { name: customer?.name })}</p>
        </div>
      ) : (
        <form id="credit-form" onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-700">{t('credit.customer')}</span>
            <CustomerPicker customers={activeCustomers} stats={ledger.customers} value={customerId} onChange={setCustomerId}
              error={errors.customer && t(`validation.${errors.customer}`)} autoFocus={!props.customerId} />
          </div>
          <Field label={t('credit.amount')} error={errors.amount && t(`validation.${errors.amount}`)}>
            {(p) => <AmountInput {...p} currency={currency} value={amountText} onChange={(e) => setAmountText(e.target.value)} invalid={!!errors.amount} placeholder="0" />}
          </Field>
          {customer && !amountResult.error && (
            <p className="-mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
              {t('credit.currentBalance', { amount: fmt.money(balance) })} → <strong className="text-ink-900">{t('credit.newBalance', { amount: fmt.money(balance + amountResult.minor) })}</strong>
            </p>
          )}
          <Field label={t('credit.description')} optional optionalText={t('common.optional')}>
            {(p) => <TextInput {...p} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('credit.descriptionPh')} maxLength={140} />}
          </Field>
          <Field label={t('credit.date')} error={errors.date && t(`validation.${errors.date}`)}>
            {(p) => <TextInput {...p} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} />}
          </Field>
          {formError && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm text-danger-600">{formError}</p>}
        </form>
      )}
    </Modal>
  );
}

export { Money };
