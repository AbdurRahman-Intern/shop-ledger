// BUTTON — one component for every action so sizes, colors and touch targets stay consistent.
// Variants follow the color psychology rules in tailwind.config.js:
//   primary (pink)   : default call-to-action
//   accent  (orange) : the one important money action on a screen (e.g. Take payment)
//   secondary        : neutral outline
//   ghost            : low emphasis
//   danger           : destructive confirmation
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/utils.js';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 disabled:bg-accent-300',
  success: 'bg-mint-600 text-white hover:bg-mint-700 disabled:bg-mint-300',
  secondary: 'bg-white text-ink-800 border border-ink-300 hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300',
  ghost: 'text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-400',
  danger: 'bg-danger-500 text-white hover:bg-danger-600 disabled:bg-danger-100 disabled:text-white',
};
const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  icon: 'h-11 w-11 rounded-xl justify-center',
};

export default function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-semibold transition-colors select-none disabled:cursor-not-allowed',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}
