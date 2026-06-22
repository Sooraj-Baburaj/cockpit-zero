/**
 * The AI "spark" glyph — the 4-point sparkle that marks every AI surface (the
 * search row in AI mode, the "AI mode" pill, the "Answer" tag, the offer chip).
 * `pair` draws the second, smaller star (the two-star variant used in the search
 * row and the lit suggestion chip); the single star is used for the inline tags.
 */
export function Sparkle({ className, pair = false }: { className?: string; pair?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3c.5 4 1.5 5 5.5 5.5-4 .5-5 1.5-5.5 5.5-.5-4-1.5-5-5.5-5.5 4-.5 5-1.5 5.5-5.5Z" />
      {pair && (
        <path d="M18.5 14c.3 1.7.7 2.2 2.5 2.5-1.8.3-2.2.8-2.5 2.5-.3-1.7-.7-2.2-2.5-2.5 1.8-.3 2.2-.8 2.5-2.5Z" />
      )}
    </svg>
  );
}
