/** The matched keyword rendered as a lit accent chip while capturing an
 *  argument (L2) — the one accent moment of that view. */
export function ArgumentChip({ keyword }: { keyword: string }) {
  return (
    <span className="inline-flex h-[30px] items-center rounded-[var(--cz-radius-chip)] px-[11px] font-mono text-sm font-semibold text-accent-fg [background:var(--cz-accent)] [box-shadow:var(--cz-glow-chip)]">
      {keyword}
    </span>
  );
}
