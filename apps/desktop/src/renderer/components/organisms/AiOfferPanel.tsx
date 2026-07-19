import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { Sparkle } from '../atoms/Sparkle.js';

/**
 * The "no match → hand it to the assistant" body (matches `ai-mode.html`): a quiet
 * empty-state line, then two lit choices — **Ask** the assistant (a prose answer,
 * Phase 2) or **Do this for me** (start an agent task with tools + memory + review,
 * Phase 7). The selected row is the view's one accent moment; the parent owns
 * selection (↑↓) and activation (↵ / click).
 */
export function AiOfferPanel({
  query,
  listboxId,
  optionId,
  selected,
  onRun,
  onHover,
}: {
  /** The (trimmed) query the assistant would be asked / the task intent. */
  query: string;
  listboxId: string;
  optionId: (index: number) => string;
  /** Index of the selected row (0 = ask, 1 = do it). */
  selected: number;
  /** Activate the row at `index`. */
  onRun: (index: number) => void;
  /** Hover the row at `index`. */
  onHover: (index: number) => void;
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

      <div className="px-5 pt-3.5 pb-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--cz-accent-text)] uppercase">
        Ask AI
      </div>
      <ul
        role="listbox"
        id={listboxId}
        aria-label="Hand off to the assistant"
        className="px-3.5 pb-2"
      >
        <OfferRow
          optionId={optionId(0)}
          selected={selected === 0}
          onRun={() => onRun(0)}
          onHover={() => onHover(0)}
          icon={<Sparkle className="size-[19px]" pair />}
          title={
            <>
              Ask <span className="text-[var(--cz-accent-text)] italic">“{query}”</span>
            </>
          }
          subtitle="CockpitZero AI · answers from your workspace and history"
          chip="↵ ask"
        />
        <OfferRow
          optionId={optionId(1)}
          selected={selected === 1}
          onRun={() => onRun(1)}
          onHover={() => onHover(1)}
          icon={
            <svg
              viewBox="0 0 24 24"
              className="size-[19px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 4v4h4M12 8v4l3 2" />
            </svg>
          }
          title="Do this for me"
          subtitle="Run it as a task — tools, memory, and a review before anything’s saved"
          chip="↵ run"
        />
      </ul>
    </div>
  );
}

/** One offer choice — lit (accent) when selected, quiet otherwise. */
function OfferRow({
  optionId,
  selected,
  onRun,
  onHover,
  icon,
  title,
  subtitle,
  chip,
}: {
  optionId: string;
  selected: boolean;
  onRun: () => void;
  onHover: () => void;
  icon: ReactNode;
  title: ReactNode;
  subtitle: string;
  chip: string;
}) {
  return (
    <li
      id={optionId}
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onClick={onRun}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3.5 rounded-[var(--cz-radius-md)] border p-3.5',
        selected
          ? '[background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-focus-ring)]'
          : 'border-transparent',
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-[var(--cz-radius-md)] transition-colors',
            selected
              ? 'text-accent-fg [background:var(--cz-accent)] [box-shadow:var(--cz-glow-chip)]'
              : 'bg-surface-2 border border-border text-muted',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="truncate text-base font-medium text-fg">{title}</div>
          <div className="mt-[3px] truncate text-[13px] text-subtle">{subtitle}</div>
        </div>
      </div>
      {selected && (
        <span className="shrink-0 rounded-[var(--cz-radius-xs)] border px-[9px] py-1 font-mono text-xs font-medium text-[var(--cz-accent-text)] [background:var(--cz-surface)] [border-color:var(--cz-accent-line)]">
          {chip}
        </span>
      )}
    </li>
  );
}
