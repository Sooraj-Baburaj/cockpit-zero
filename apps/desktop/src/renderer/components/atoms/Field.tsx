import { cn } from '../../lib/cn.js';

/** Labelled form field: a title, optional description, and the control. */
export function Field({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  /** Extra classes for the wrapper (e.g. flex sizing in a field row). */
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-sm font-medium text-fg">{label}</span>
      {description && (
        <span className="mt-0.5 mb-2 block text-xs leading-normal text-muted">{description}</span>
      )}
      <span className={description ? 'block' : 'mt-1.5 block'}>{children}</span>
    </label>
  );
}
