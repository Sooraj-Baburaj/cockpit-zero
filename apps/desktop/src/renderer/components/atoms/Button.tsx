import { cn } from '../../lib/cn.js';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md';

/**
 * Sahara action button. `primary` is the one accent moment — a solid sienna
 * fill with a standing edge; `ghost` is the quiet warm-inset default; `outline`
 * lights its hairline on hover; `danger` is warm-coral text with a faint wash.
 */
const variants: Record<Variant, string> = {
  primary:
    'text-accent-fg [background:var(--cz-accent-grad)] [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-glow-accent)] hover:[box-shadow:var(--cz-glow-accent-strong)]',
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
