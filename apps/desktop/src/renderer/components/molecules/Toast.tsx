import { cn } from '../../lib/cn.js';

/** A brief run-confirmation card shown over the launcher footer — a small
 *  facet slab with an accent (or coral, on error) glyph. Purely presentational. */
export function Toast({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-11 z-20 flex justify-center"
    >
      <div
        className={cn(
          'cz-appear flex items-center gap-2 rounded-[var(--cz-radius-lg)] border border-border bg-surface px-4 py-[11px] text-[13.5px] text-fg [box-shadow:var(--cz-shadow-md)]',
          error ? '[&>svg]:text-[var(--cz-danger)]' : '[&>svg]:text-[var(--cz-accent-text)]',
        )}
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {error ? <path d="M8 4v5M8 11.5v.5" /> : <path d="m3 8.5 3.2 3L13 5" />}
        </svg>
        {message}
      </div>
    </div>
  );
}
