/** Labelled form field: a title, optional description, and the control. */
export function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-fg">{label}</span>
      {description && <span className="block text-xs text-muted">{description}</span>}
      {children}
    </label>
  );
}
