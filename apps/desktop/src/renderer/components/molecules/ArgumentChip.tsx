/** The matched keyword rendered as a glowing sienna pill while capturing an
 *  argument (L2) — the one accent moment of that view. */
export function ArgumentChip({ keyword }: { keyword: string }) {
  return (
    <span className="inline-flex items-center rounded-md border px-[9px] py-1 font-mono text-base font-semibold text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-glow-accent-soft)]">
      {keyword}
    </span>
  );
}
