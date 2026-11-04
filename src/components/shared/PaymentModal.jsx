// TAKE PAYMENT dialog — the most frequent action in the product, so it is built for speed:
//   pick customer (or arrive pre-selected) → type amount (or tap "Pay full") → Save.
// Payments cannot exceed the balance; they are split across unpaid credits oldest-first
// (shopkeepers settle the oldest debt first), with an optional "apply to this credit" override.
import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, TextInput, AmountInput, SelectInput, Segmented } from '../ui/Form.jsx';
import { Money } from '../ui/Display.jsx';
import CustomerPicker from './CustomerPicker.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { useDataStore } from '../../store/dataStore.js';
import { useUiStore } from '../../store/uiStore.js';
import { useLedger } from '../../hooks/useLedger.js';
import { useErrorText } from '../../hooks/useMisc.js';
import { validateAmount, validateDate } from '../../lib/validation.js';
import { allocatePayment, minorToInput } from '../../lib/finance.js';
import { todayISO } from '../../lib/dates.js';
import { PAYMENT_METHODS } from '../../config/appConfig.js';

export default function PaymentModal() {
  const { t, fmt, currency, decimals } = useI18n();
  const errorText = useErrorText();
  const props = useUiStore((s) => s.modals.payment);
  const addPayment = useDataStore((s) => s.addPayment);
  const { data, ledger } = useLedger();

  const [customerId, setCustomerId] = useState(null);
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [creditId, setCreditId] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (props) {
      setCustomerId(props.customerId || null); setAmountText(''); setMethod('cash'); setDate(todayISO());
      setNote(''); setCreditId(props.creditId || ''); setErrors({}); setFormError('');
    }
  }, [props]);

  const debtors = useMemo(() => data.customers.filter((c) => !c.archived && (ledger.customers.get(c.id)?.balance || 0) > 0), [data.customers, ledger]);
  const customer = data.customers.find((c) => c.id === customerId);
  const stats = customerId ? ledger.customers.get(customerId) : null;
  const balance = stats?.balance || 0;
  const amountResult = validateAmount(amountText, decimals, { max: balance || null });

  // Preview where the money will go, using the same function the service uses on save.
  const openCredits = useMemo(
    () => (stats?.openCredits || []).map((c) => ({ ...c, remaining: ledger.creditState.get(c.id).remaining })),
    [stats, ledger],
  );
  const preview = useMemo(() => {
    if (!amountResult.minor || amountResult.error) return [];
    return allocatePayment(amountResult.minor, openCredits, creditId || null).allocations;
  }, [amountResult, openCredits, creditId]);

  if (!props) return null;
  const close = () => useUiStore.getState().closeModal('payment');

  const submit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!customerId) errs.customer = 'selectCustomer';
    if (amountResult.error) errs.amount = amountResult.error;
    const dateErr = validateDate(date);
    if (dateErr) errs.date = dateErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true); setFormError('');
    try {
      const { payment } = await addPayment({ customerId, amount: amountResult.minor, date, method, note, creditId: creditId || null });
      useUiStore.getState().toast('success', t('payment.saved', { amount: fmt.money(payment.amount), name: customer.name }), {
        duration: 7000,
        action: { label: t('payment.viewReceipt'), onClick: () => useUiStore.getState().openModal('receipt', { paymentId: payment.id }) },
      });
      close();
      props.onSaved?.(payment);
    } catch (err) { setFormError(errorText(err)); }
    finally { setBusy(false); }
  };

  const noDebtors = debtors.length === 0 && !props.customerId;
  const creditsById = new Map(data.credits.map((c) => [c.id, c]));

  return (
    <Modal open onClose={close} title={t('payment.title')} subtitle={customer ? undefined : t('payment.subtitle')}
      footer={noDebtors ? null : (
        <>
          <Button variant="secondary" onClick={close}>{t('common.cancel')}</Button>
          <Button variant="accent" type="submit" form="payment-form" loading={busy} icon={Check}>{t('payment.save')}</Button>
        </>
      )}>
      {noDebtors ? (
        <div className="py-6 text-center">
          <h3 className="font-bold">{t('payment.noBalanceTitle')}</h3>
          <p className="mx-auto mt-1 max-w-xs text-ink-500">{t('payment.noBalanceText')}</p>
        </div>
      ) : (
        <form id="payment-form" onSubmit={submit} className="space-y-4" noValidate>
          {props.customerId && customer ? (
            // Arrived from a customer page: no need to pick again.
            <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 p-3">
              <div className="min-w-0"><p className="truncate font-semibold">{customer.name}</p><p className="text-sm text-ink-500">{t('payment.owedBy', { amount: fmt.money(balance) })}</p></div>
            </div>
          ) : (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink-700">{t('payment.customer')}</span>
              <CustomerPicker customers={debtors} stats={ledger.customers} value={customerId}
                onChange={(id) => { setCustomerId(id); setCreditId(''); }} error={errors.customer && t(`validation.${errors.customer}`)} autoFocus />
            </div>
          )}

          {customerId && balance === 0 && <p className="rounded-xl bg-mint-50 p-3 text-sm text-mint-700">{t('payment.nothingOwed', { name: customer?.name })}</p>}

          {customerId && balance > 0 && (
            <>
              <Field label={t('payment.amount')} error={errors.amount && t(errors.amount === 'amountExceedsBalance' ? 'validation.amountExceedsBalance' : `validation.${errors.amount}`)}>
                {(p) => (
                  <div>
                    <AmountInput {...p} currency={currency} value={amountText} onChange={(e) => setAmountText(e.target.value)} invalid={!!errors.amount} placeholder="0" autoFocus={!!props.customerId} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setAmountText(minorToInput(balance, decimals))} className="touch rounded-lg bg-mint-50 px-3 text-sm font-semibold text-mint-700 hover:bg-mint-100">{t('payment.payFull')} · <Money minor={balance} /></button>
                      <button type="button" onClick={() => setAmountText(minorToInput(Math.floor(balance / 2), decimals))} className="touch rounded-lg bg-ink-100 px-3 text-sm font-semibold text-ink-700 hover:bg-ink-200">{t('payment.payHalf')}</button>
                    </div>
                  </div>
                )}
              </Field>

              {!amountResult.error && (
                <div className="rounded-xl border border-ink-200 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-ink-500">{t('payment.balanceBefore')}</span><Money minor={balance} /></div>
                  <div className="mt-1 flex justify-between font-semibold"><span>{t('payment.balanceAfter')}</span><Money minor={balance - amountResult.minor} tone={balance - amountResult.minor === 0 ? 'positive' : undefined} /></div>
                  {preview.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-ink-100 pt-2 text-ink-600">
                      {preview.map((a) => {
                        const credit = creditsById.get(a.creditId);
                        const full = a.amount === openCredits.find((c) => c.id === a.creditId)?.remaining;
                        return (
                          <li key={a.creditId} className="flex items-center justify-between gap-2">
                            <span className="truncate">{full ? t('payment.willSettle') : t('payment.willReduce')} · {credit?.description || fmt.date(credit?.date, 'short')}</span>
                            <Money minor={a.amount} className="shrink-0" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              <Field label={t('payment.method')}>
                {() => <div><Segmented value={method} onChange={setMethod} label={t('payment.method')} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) }))} /></div>}
              </Field>

              {openCredits.length > 1 && (
                <Field label={t('payment.chooseCredit')} hint={t('payment.oldestFirst')}>
                  {(p) => (
                    <SelectInput {...p} value={creditId} onChange={(e) => setCreditId(e.target.value)}>
                      <option value="">{t('payment.autoOldest')}</option>
                      {openCredits.map((c) => <option key={c.id} value={c.id}>{fmt.date(c.date, 'short')} · {c.description || '—'} · {fmt.money(c.remaining)}</option>)}
                    </SelectInput>
                  )}
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('payment.date')} error={errors.date && t(`validation.${errors.date}`)}>
                  {(p) => <TextInput {...p} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} invalid={!!errors.date} />}
                </Field>
                <Field label={t('payment.note')} optional optionalText={t('common.optional')}>
                  {(p) => <TextInput {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('payment.notePh')} maxLength={120} />}
                </Field>
              </div>
            </>
          )}
          {formError && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm text-danger-600">{formError}</p>}
        </form>
      )}
    </Modal>
  );
}
