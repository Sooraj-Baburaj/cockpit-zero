import { cn } from '../../lib/cn.js';

/** A brief run-confirmation pill shown over the launcher footer. `error` turns
 *  it warm-coral; success is sienna. Purely presentational. */
export function Toast({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-11 z-20 flex justify-center"
    >
      <div
        className={cn(
          'cz-appear flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-[var(--cz-shadow-md)]',
          error
            ? 'text-[var(--cz-danger)] [background:var(--cz-danger-soft)] border-transparent'
            : 'text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]',
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
