// Business identity block (logo + name + contact) shown at the top of receipts and statements.
// If the business has no logo we draw a simple initial badge instead of leaving a hole.
import { Avatar } from '../ui/Display.jsx';

export default function BusinessMark({ tenant, align = 'center' }) {
  return (
    <div className={`flex flex-col gap-2 ${align === 'center' ? 'items-center text-center' : 'items-start text-start'}`}>
      {tenant.logo
        ? <img src={tenant.logo} alt="" className="h-14 w-14 rounded-xl object-cover" />
        : <Avatar name={tenant.name} size="lg" />}
      <div>
        <p className="text-lg font-bold text-ink-900">{tenant.name}</p>
        {(tenant.phone || tenant.address) && (
          <p className="text-sm text-ink-500">
            {tenant.phone && <bdi dir="ltr">{tenant.phone}</bdi>}
            {tenant.phone && tenant.address && ' · '}
            {tenant.address}
          </p>
        )}
      </div>
    </div>
  );
}
