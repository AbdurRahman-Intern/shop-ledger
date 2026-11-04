// TEAM — invite people and assign roles. Only owners can change the team; managers can view it.
// TODO(backend): invitations by e-mail with signed expiring links; roles/permissions via Laravel Policies.
import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Check, Minus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { useAuthStore } from '../store/authStore.js';
import { useUiStore } from '../store/uiStore.js';
import { usePermission, useTitle, useErrorText } from '../hooks/useMisc.js';
import { Card, CardHeader, PageHeader, Avatar, Badge, TableWrap, Th, Td, ProgressBar, Spinner } from '../components/ui/Display.jsx';
import { Field, TextInput, SelectInput } from '../components/ui/Form.jsx';
import Modal, { ConfirmDialog } from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import * as auth from '../services/authService.js';
import { ROLES, PERMISSIONS, PLANS, can } from '../config/appConfig.js';
import { validateEmail } from '../lib/validation.js';
import { APP } from '../config/appConfig.js';

// Rows of the "what can each role do" matrix → permission keys.
const MATRIX = [
  ['viewTotals', 'reports.view'], ['addCustomers', 'customers.edit'], ['recordMoney', null], ['voidEntries', 'records.void'],
  ['archiveCustomers', 'customers.archive'], ['manageTeam', 'team.manage'], ['manageSettings', 'settings.manage'],
];

export default function Team() {
  const { t, fmt } = useI18n();
  useTitle(t('nav.team'));
  const errorText = useErrorText();
  const toast = useUiStore((s) => s.toast);
  const tenant = useAuthStore((s) => s.tenant);
  const me = useAuthStore((s) => s.user);
  const canManage = usePermission('team.manage');
  const [rows, setRows] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'employee' });
  const [formErr, setFormErr] = useState('');
  const [created, setCreated] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => setRows(await auth.listTeam(tenant.id)), [tenant.id]);
  useEffect(() => { load(); }, [load]);

  const limit = PLANS[tenant.subscription.planId].limits.members;
  const used = rows?.length || 0;
  const atLimit = used >= limit;

  const invite = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(form.email);
    if (emailErr) return setFormErr(t(`validation.${emailErr}`));
    if (atLimit) return setFormErr(t('team.limitReached', { limit: fmt.number(limit) }));
    try {
      const res = await auth.inviteMember(tenant.id, form);
      setCreated({ email: form.email, password: res.temporaryPassword });
      setForm({ name: '', email: '', role: 'employee' }); setFormErr(''); await load();
    } catch (err) { setFormErr(errorText(err)); }
  };
  const changeRole = async (memberId, role) => {
    try { await auth.changeMemberRole(memberId, role); toast('success', t('team.roleChanged')); await load(); } catch (err) { toast('error', errorText(err)); await load(); }
  };
  const remove = async () => {
    try { await auth.removeMember(removing.member.id); toast('success', t('team.removed')); await load(); } catch (err) { toast('error', errorText(err)); }
    setRemoving(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('team.title')} subtitle={t('team.subtitle')} actions={canManage && <Button icon={UserPlus} onClick={() => { setInviteOpen(true); setCreated(null); setFormErr(''); }} disabled={atLimit}>{t('team.invite')}</Button>} />
      <Card className="p-5">
        <div className="flex items-center justify-between text-sm"><span className="font-semibold">{t('team.seats', { used: fmt.number(used), limit: fmt.number(limit) })}</span>{atLimit && <Badge tone="warning">{t('plans.atLimit')}</Badge>}</div>
        <div className="mt-2"><ProgressBar value={used} max={limit} tone={atLimit ? 'warning' : 'success'} label={t('plans.usageMembers')} /></div>
        {!canManage && <p className="mt-3 text-sm text-ink-500">{t('team.ownerOnly')}</p>}
      </Card>

      <Card as="div" className="overflow-hidden">
        {!rows ? <div className="flex justify-center p-10"><Spinner /></div> : (
          <ul className="divide-y divide-ink-100">
            {rows.map(({ member, user }) => {
              const isMe = user.id === me.id;
              return (
                <li key={member.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0"><p className="flex items-center gap-2 truncate font-semibold">{user.name}{isMe && <Badge tone="brand">{t('team.you')}</Badge>}{member.status === 'invited' && <Badge tone="warning">{t('team.pendingInvite')}</Badge>}</p>
                      <bdi dir="ltr" className="block truncate text-sm text-ink-500">{user.email}</bdi></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && !isMe ? (
                      <SelectInput aria-label={t('team.changeRole')} value={member.role} onChange={(e) => changeRole(member.id, e.target.value)} className="sm:w-40">
                        {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                      </SelectInput>
                    ) : <Badge tone={member.role === 'owner' ? 'brand' : 'neutral'}>{t(`roles.${member.role}`)}</Badge>}
                    {canManage && !isMe && <button onClick={() => setRemoving({ member, user })} aria-label={t('team.remove')} title={t('team.remove')} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-400 hover:bg-danger-50 hover:text-danger-500"><Trash2 className="h-[18px] w-[18px]" /></button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={t('team.permissions')} />
        <TableWrap className="mt-3">
          <thead><tr><Th />{ROLES.map((r) => <Th key={r} align="end">{t(`roles.${r}`)}</Th>)}</tr></thead>
          <tbody>{MATRIX.map(([label, perm]) => (
            <tr key={label}><Td>{t(`team.matrix.${label}`)}</Td>
              {ROLES.map((r) => { const ok = perm ? can(r, perm) : true; return <Td key={r} align="end">{ok ? <Check className="ms-auto h-5 w-5 text-mint-600" aria-label="✓" /> : <Minus className="ms-auto h-5 w-5 text-ink-300" aria-label="—" />}</Td>; })}</tr>))}</tbody>
        </TableWrap>
        <ul className="space-y-1 p-5 text-sm text-ink-500">{ROLES.map((r) => <li key={r}><strong className="text-ink-700">{t(`roles.${r}`)}:</strong> {t(`rolesHelp.${r}`)}</li>)}</ul>
      </Card>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t('team.inviteTitle')} size="sm"
        footer={created ? <Button onClick={() => setInviteOpen(false)}>{t('common.done')}</Button> : <><Button variant="secondary" onClick={() => setInviteOpen(false)}>{t('common.cancel')}</Button><Button type="submit" form="invite-form">{t('team.invite')}</Button></>}>
        {created ? (
          <div className="rounded-xl bg-mint-50 p-4 text-mint-700"><h3 className="font-bold">{t('team.tempPasswordTitle')}</h3><p className="mt-1 text-[15px]">{t('team.tempPasswordText', { email: created.email, password: created.password })}</p></div>
        ) : (
          <form id="invite-form" onSubmit={invite} className="space-y-4" noValidate>
            <p className="text-sm text-ink-500">{t('team.inviteText', { password: APP.demoPassword })}</p>
            <Field label={t('team.name')} optional optionalText={t('common.optional')}>{(p) => <TextInput {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label={t('team.email')}>{(p) => <TextInput {...p} type="email" dir="ltr" className="text-start" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
            <Field label={t('team.role')}>{(p) => <SelectInput {...p} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.filter((r) => r !== 'owner').map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</SelectInput>}</Field>
            {formErr && <p role="alert" className="rounded-xl bg-danger-50 p-3 text-sm text-danger-600">{formErr}</p>}
          </form>
        )}
      </Modal>
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} danger title={t('team.removeTitle', { name: removing?.user.name })} text={t('team.removeText')} confirmLabel={t('team.remove')} />
    </div>
  );
}

export { PERMISSIONS };
