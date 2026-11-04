// ADD / EDIT CUSTOMER dialog.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { Field, TextInput, TextArea } from '../ui/Form.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { useDataStore } from '../../store/dataStore.js';
import { useUiStore } from '../../store/uiStore.js';
import { validateCustomer } from '../../lib/validation.js';
import { useErrorText } from '../../hooks/useMisc.js';

export default function CustomerModal() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const props = useUiStore((s) => s.modals.customer);
  const close = useUiStore((s) => s.closeModal);
  const toast = useUiStore((s) => s.toast);
  const addCustomer = useDataStore((s) => s.addCustomer);
  const editCustomer = useDataStore((s) => s.editCustomer);

  const editing = props?.customer || null;
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (props) {
      setForm({ name: editing?.name || '', phone: editing?.phone || '', address: editing?.address || '', note: editing?.note || '' });
      setErrors({}); setFormError(null);
    }
  }, [props]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!props) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateCustomer(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFormError(null);
    try {
      if (editing) {
        await editCustomer(editing.id, form);
        toast('success', t('customers.updated'));
        close('customer');
      } else {
        const customer = await addCustomer(form);
        toast('success', t('customers.saved'));
        close('customer');
        props.onCreated ? props.onCreated(customer) : navigate(`/customers/${customer.id}`);
      }
    } catch (err) {
      setFormError({ text: errorText(err), upgrade: err.code === 'PLAN_LIMIT_CUSTOMERS' });
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={() => close('customer')} title={editing ? t('customers.edit') : t('customers.add')}
      footer={<>
        <Button variant="secondary" onClick={() => close('customer')}>{t('common.cancel')}</Button>
        <Button type="submit" form="customer-form" loading={busy}>{t('common.save')}</Button>
      </>}>
      <form id="customer-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('common.name')} error={errors.name && t(`validation.${errors.name}`)}>
          {(p) => <TextInput {...p} value={form.name} onChange={set('name')} placeholder={t('customers.namePh')} invalid={!!errors.name} maxLength={90} autoComplete="off" />}
        </Field>
        <Field label={t('common.phone')} optional optionalText={t('common.optional')} error={errors.phone && t(`validation.${errors.phone}`)}>
          {(p) => <TextInput {...p} dir="ltr" className="text-start" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder={t('customers.phonePh')} invalid={!!errors.phone} />}
        </Field>
        <Field label={t('common.address')} optional optionalText={t('common.optional')}>
          {(p) => <TextInput {...p} value={form.address} onChange={set('address')} placeholder={t('customers.addressPh')} />}
        </Field>
        <Field label={t('common.note')} optional optionalText={t('common.optional')}>
          {(p) => <TextArea {...p} value={form.note} onChange={set('note')} placeholder={t('customers.notePh')} />}
        </Field>
        {formError && (
          <div role="alert" className="rounded-xl bg-danger-50 p-3 text-sm text-danger-600">
            {formError.text}
            {formError.upgrade && <button type="button" className="ms-2 font-bold underline" onClick={() => { close('customer'); navigate('/plans'); }}>{t('reports.upgrade')}</button>}
          </div>
        )}
      </form>
    </Modal>
  );
}
