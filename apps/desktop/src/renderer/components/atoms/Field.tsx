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
    <label className="block">
      <span className="block text-sm font-medium text-fg">{label}</span>
      {description && (
        <span className="mt-0.5 mb-2 block text-xs leading-normal text-muted">{description}</span>
      )}
      <span className={description ? 'block' : 'mt-1.5 block'}>{children}</span>
    </label>
  );
}
