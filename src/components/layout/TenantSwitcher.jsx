// BUSINESS SWITCHER — demonstrates multi-tenancy. A user can belong to several businesses
// (with a different role in each) and switch between them; each business has completely
// separate customers, transactions and settings.
// SECURITY NOTE: this only changes which tenantId the UI shows. In production the API verifies
// membership on every request, so editing this value in dev tools reveals nothing.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { useI18n } from '../../i18n/useI18n.js';
import { Avatar } from '../ui/Display.jsx';
import { cx } from '../../lib/utils.js';

export default function TenantSwitcher({ className }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const memberships = useAuthStore((s) => s.memberships);
  const tenant = useAuthStore((s) => s.tenant);
  const role = useAuthStore((s) => s.role);
  const switchTenant = useAuthStore((s) => s.switchTenant);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!tenant) return null;
  return (
    <div ref={ref} className={cx('relative', className)}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className="touch flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-2.5 text-start hover:bg-ink-50">
        {tenant.logo ? <img src={tenant.logo} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <Avatar name={tenant.name} size="md" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink-900">{tenant.name}</span>
          <span className="block truncate text-xs text-ink-500">{t(`roles.${role}`)}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
      </button>
      {open && (
        <div role="listbox" aria-label={t('header.switchBusiness')} className="anim-pop absolute inset-x-0 top-full z-40 mt-2 rounded-xl border border-ink-200 bg-white p-1.5 shadow-pop">
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-ink-400">{t('header.switchBusiness')}</p>
          {memberships.map(({ tenant: tn, member }) => (
            <button key={tn.id} role="option" aria-selected={tn.id === tenant.id}
              onClick={() => { switchTenant(tn.id); setOpen(false); navigate('/'); }}
              className="touch flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start hover:bg-ink-50">
              <Avatar name={tn.name} size="sm" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{tn.name}</span><span className="block text-xs text-ink-500">{t(`roles.${member.role}`)}</span></span>
              {tn.id === tenant.id && <Check className="h-4 w-4 text-brand-600" aria-hidden />}
            </button>
          ))}
          <button onClick={() => { setOpen(false); navigate('/onboarding?new=1'); }}
            className="touch mt-1 flex w-full items-center gap-3 rounded-lg border-t border-ink-100 px-2.5 py-2.5 text-start text-sm font-medium text-brand-700 hover:bg-brand-50">
            <Plus className="h-4 w-4" aria-hidden />{t('header.createBusiness')}
          </button>
        </div>
      )}
    </div>
  );
}
