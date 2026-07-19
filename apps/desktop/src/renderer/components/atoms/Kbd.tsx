import { cn } from '../../lib/cn.js';

/**
 * A keycap-styled inline hint, e.g. ↵ or Esc — the Facet `kcap`: an inset well
 * with a 2px bottom edge so the cap reads as a physically raised key. `accent`
 * is the lit variant (the selected row's run hint).
 */
export function Kbd({
  children,
  accent = false,
  className,
}: {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[22px] min-w-[20px] items-center justify-center rounded-[var(--cz-radius-kbd)] border border-b-2 px-1.5 font-mono text-xs leading-none font-medium',
        accent
          ? 'border-transparent text-[var(--cz-accent-fg)] [background:var(--cz-accent)]'
          : 'border-border bg-[var(--cz-surface-inset)] text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
