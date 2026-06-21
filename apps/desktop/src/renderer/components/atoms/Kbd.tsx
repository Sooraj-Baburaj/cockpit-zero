import { cn } from '../../lib/cn.js';

/** A keycap-styled inline hint, e.g. ↵ or Esc. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border [border-color:var(--cz-line-strong)] bg-surface-2 px-[5px] font-sans text-[11px] leading-none text-muted [box-shadow:var(--cz-rim-inset)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
