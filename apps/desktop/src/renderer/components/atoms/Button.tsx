import { cn } from '../../lib/cn.js';

type Variant = 'primary' | 'dark' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md';

/**
 * Sahara action button. `primary` is the one accent moment — a solid sienna
 * fill with a standing edge; `dark` is the fixed warm-espresso CTA used across
 * the AI/roadmap surfaces (a neutral-warm fill that keeps sienna reserved for the
 * one accent moment); `ghost` is the quiet warm-inset default; `outline` lights
 * its hairline on hover; `danger` is warm-coral text with a faint wash.
 */
const variants: Record<Variant, string> = {
  primary:
    'text-accent-fg [background:var(--cz-accent-grad)] [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-glow-accent)] hover:[box-shadow:var(--cz-glow-accent-strong)]',
  // Fixed warm-dark fill (same in both themes by design — it's not theme-tinted),
  // matching the cockpit-ai mockup's Ask / Save buttons.
  dark: 'text-[#fffaf3] bg-[#3a302a] [border-color:#2c241f] [box-shadow:var(--cz-shadow-md)] hover:bg-[#332a24]',
  ghost: 'text-fg bg-surface-2 border-border hover:bg-[var(--cz-glass-3)]',
  outline:
    'text-fg bg-transparent [border-color:var(--cz-line-strong)] hover:[border-color:var(--cz-accent-line)] hover:[box-shadow:var(--cz-glow-accent-soft)]',
  danger: 'text-[var(--cz-danger)] bg-transparent hover:bg-[var(--cz-danger-soft)]',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3.5 py-2 text-sm',
};

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-medium whitespace-nowrap transition select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
