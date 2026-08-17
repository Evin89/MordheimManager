import { forwardRef } from 'react';

/**
 * The one primary/secondary/danger button (spec §5.1, §5.4).
 *
 * Before this, the same button was hand-written ~11 ways across the screens —
 * min-h 40/44/48/52, `disabled:opacity-40/50/60`, sometimes `text-sm`, sometimes
 * not. Encoding it once is the whole point: a screen can't drift from a shape it
 * doesn't spell out.
 *
 * Colours go through the theme roles, not the ember scale directly, so the same
 * button is ember-on-near-black under Grimdark and blood-on-white under Rulebook
 * without either theme knowing. `text-on-accent` is the token that keeps the
 * label legible on the accent in *both* — near-black on Grimdark's light ember,
 * white on Rulebook's dark blood (a hardcoded white fails AA on ember).
 *
 * `buttonClasses` is exported for the handful of call sites that need a
 * `<Link>`/`<a>` styled as a button — same look, no wrapper gymnastics.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'dense';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ember-500 hover:bg-ember-600 text-on-accent font-semibold',
  secondary: 'border border-ink-700 text-bone-100 font-semibold hover:bg-ink-800',
  // The established destructive look: outlined red that fills on hover, never a
  // near-black `on-accent` label on dark red (which neither theme reads).
  danger:
    'border border-blood-600 text-blood-500 font-semibold hover:bg-blood-600 hover:text-bone-100',
  ghost: 'text-ember-400 font-semibold hover:text-ember-500',
};

// §5.4: 48px is the floor. `dense` is the recorded 40px deviation for the packed
// list screens (tab rows, the Buy button) — opt-in, never the default.
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-4',
  dense: 'min-h-[40px] px-3 text-sm',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = true,
): string {
  return [
    'inline-flex items-center justify-center rounded-md transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    fullWidth ? 'w-full' : '',
    SIZES[size],
    VARIANTS[variant],
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth = true, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${buttonClasses(variant, size, fullWidth)} ${className}`.trim()}
      {...rest}
    />
  );
});

export default Button;
