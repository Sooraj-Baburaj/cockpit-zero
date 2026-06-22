import { Sparkle } from '../atoms/Sparkle.js';

/**
 * The "no match → ask the assistant" body (matches `ai-mode.html`): a quiet
 * empty-state line explaining nothing matched, then a single lit "Ask «query»"
 * row that runs the ask on Enter/click. The row is the view's one accent moment.
 */
export function AiOfferPanel({
  query,
  listboxId,
  optionId,
  selected,
  onRun,
  onHover,
}: {
  /** The (trimmed) query the assistant would be asked. */
  query: string;
  listboxId: string;
  optionId: string;
  selected: boolean;
  /** Fire the ask. */
  onRun: () => void;
  onHover: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-[13px] px-5 py-4">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[var(--cz-radius-md)] border border-border bg-surface-2 text-subtle">
          <svg
            viewBox="0 0 24 24"
            className="size-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3M8.5 11h5" />
          </svg>
        </span>
        <div>
          <div className="text-sm font-medium text-muted">No matching actions, apps, or files</div>
          <div className="mt-0.5 text-[13px] text-subtle">
            Nothing in your library matches — hand it to the assistant instead.
          </div>
        </div>
      </div>

      <div className="px-5 pt-3.5 pb-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--cz-accent-bright)] uppercase">
        Ask AI
      </div>
      <ul role="listbox" id={listboxId} aria-label="Ask AI" className="px-3.5 pb-2">
        <li
          id={optionId}
          role="option"
          aria-selected={selected}
          onMouseEnter={onHover}
          onClick={onRun}
          className="flex cursor-pointer items-center justify-between gap-3.5 rounded-[var(--cz-radius-md)] border p-3.5 [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-ring-focus)]"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--cz-radius-md)] text-accent-fg [background:var(--cz-accent-grad)] [box-shadow:var(--cz-glow-chip)]">
              <Sparkle className="size-[19px]" pair />
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-medium text-fg">
                Ask <span className="text-[var(--cz-accent-bright)] italic">“{query}”</span>
              </div>
              <div className="mt-[3px] truncate text-[13px] text-subtle">
                CockpitZero AI · answers from your workspace and history
              </div>
            </div>
          </div>
          <span className="shrink-0 rounded-[var(--cz-radius-xs)] border px-[9px] py-1 font-mono text-xs font-medium text-[var(--cz-accent-bright)] [background:var(--cz-glass-1)] [border-color:var(--cz-accent-line)]">
            ↵ ask
          </span>
        </li>
      </ul>
    </div>
  );
}
