import { cn } from '../../lib/cn.js';

/** Themed native select. */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg outline-none transition focus:border-accent',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
