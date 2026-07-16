/**
 * Centered muted message for empty lists / no-results states. Two lines: a flat
 * statement (title) + a concrete next step (hint). `loading` renders the quiet
 * shimmer skeleton instead (two pulsing pill bars).
 */
export function EmptyState({
  title,
  hint,
  loading = false,
}: {
  title: string;
  hint?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div
        className="flex flex-col items-center gap-2.5 px-5 py-8"
        role="status"
        aria-label={title}
      >
        <span className="cz-shimmer block h-2.5 w-[46%] rounded-full bg-[var(--cz-glass-3)]" />
        <span className="cz-shimmer block h-2.5 w-[30%] rounded-full bg-[var(--cz-glass-3)]" />
      </div>
    );
  }
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-sm text-muted">{title}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}
