import { cn } from '../../lib/cn.js';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md';

/**
 * Facet action button. `primary` is the one accent moment — a solid accent
 * fill (Claude orange; neutral in monochrome mode) with a soft glow; `ghost`
 * is the quiet raised default; `outline` lights its hairline on hover;
 * `danger` is warm-coral text with a faint wash.
 */
const variants: Record<Variant, string> = {
  primary:
    'text-accent-fg [background:var(--cz-accent)] border-transparent [box-shadow:var(--cz-glow-btn)] hover:[background:var(--cz-accent-hover)] active:[background:var(--cz-accent-press)]',
  ghost: 'text-fg bg-surface-2 border-border hover:bg-[var(--cz-surface-hover)]',
  outline:
    'text-muted bg-transparent [border-color:var(--cz-line)] hover:text-fg hover:[border-color:var(--cz-line-strong)]',
  danger: 'text-[var(--cz-danger)] bg-transparent hover:bg-[var(--cz-danger-soft)]',
};

const sizes: Record<Size, string> = {
  sm: 'rounded-[var(--cz-radius-md)] px-3 py-1.5 text-xs font-semibold',
  md: 'rounded-[9px] px-[15px] py-[9px] text-sm font-semibold',
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
        'inline-flex items-center justify-center gap-2 border whitespace-nowrap transition select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
