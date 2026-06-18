import { cn } from '../../lib/cn.js';

/** Small uppercase pill for metadata (e.g. an action type). */
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase',
        className,
      )}
    >
      {children}
    </span>
  );
}
