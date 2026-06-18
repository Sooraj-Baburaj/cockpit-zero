/** The matched keyword rendered as a pill while capturing an argument (L2). */
export function ArgumentChip({ keyword }: { keyword: string }) {
  return (
    <span className="rounded-md bg-accent/20 px-2 py-1 text-sm font-semibold text-accent">
      {keyword}
    </span>
  );
}
