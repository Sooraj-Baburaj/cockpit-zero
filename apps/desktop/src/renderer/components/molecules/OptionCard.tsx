/** A bordered settings card: title + optional description on the left, a
 *  control (toggle, keycaps, button…) on the right — the Facet Console's
 *  standard preference row. */
export function OptionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--cz-radius-lg)] border border-border bg-surface-2 px-4 py-[13px]">
      <div>
        <div className="text-sm font-semibold text-fg">{title}</div>
        {description && <div className="mt-0.5 text-[12.5px] text-subtle">{description}</div>}
      </div>
      {children}
    </div>
  );
}
