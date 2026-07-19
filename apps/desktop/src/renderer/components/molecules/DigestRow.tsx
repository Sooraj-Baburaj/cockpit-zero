import type { ReactNode } from 'react';
import type { DigestItem, RoutineSourceId } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { routineSourceLabel } from '../../lib/format.js';

/** Per-source avatar glyph (thin-line, 18px). Keyed by source id. */
const SOURCE_GLYPH: Record<RoutineSourceId, ReactNode> = {
  slack: (
    <path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.5 4.5 8.4 8.4 0 0 1-4-1L3 21l1-3.5a8.4 8.4 0 0 1-1-4A8.5 8.5 0 0 1 7.5 6 8.4 8.4 0 0 1 11.5 5h.5A8.5 8.5 0 0 1 21 11v.5Z" />
  ),
  gmail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  teams: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.6a3 3 0 0 1 0 4.8M18.5 20a6 6 0 0 0-3-5.2" />
    </>
  ),
  linear: (
    <>
      <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  github: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
      <path d="M8.5 6H14a2 2 0 0 1 2 2v.5M6 8.5v7" />
    </>
  ),
  notion: (
    <>
      <path d="M6 2h9l4 4v16H6Z" />
      <path d="M15 2v4h4" />
    </>
  ),
};

/**
 * One digest item row (`routine-digest.html` `.item`): a source-glyph avatar,
 * the sender + uppercase source badge, the one-line AI summary, and a right-
 * aligned mono relative time. The `selected` (keyboard) and `top` (the single
 * accent moment — the first "needs you now" item) treatments mirror the mockup.
 */
export function DigestRow({
  item,
  selected,
  top = false,
  optionId,
  onSelect,
  onHover,
}: {
  item: DigestItem;
  selected: boolean;
  /** The top "needs you now" item — gets the one accent wash + left rail. */
  top?: boolean;
  optionId: string;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <div
      id={optionId}
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        '-mx-1.5 flex cursor-pointer items-center gap-3.5 rounded-[var(--cz-radius-md)] border border-transparent px-3.5 py-3 transition',
        top &&
          'border-[var(--cz-accent-line)] [background:var(--cz-accent-wash)] [box-shadow:inset_2px_0_0_var(--cz-accent)]',
        selected && !top && '[background:var(--cz-surface-inset)]',
      )}
    >
      <span className="grid size-9 flex-none place-items-center rounded-[var(--cz-radius-md)] border border-border text-muted [background:var(--cz-surface-inset)]">
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {SOURCE_GLYPH[item.source]}
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-fg">{item.who}</span>
          <span className="rounded-[var(--cz-radius-xs)] border border-border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-muted uppercase [background:var(--cz-surface-inset)]">
            {routineSourceLabel[item.source]}
          </span>
        </div>
        <div className="mt-[3px] text-[13.5px] leading-snug text-muted [text-wrap:pretty]">
          {item.summary}
        </div>
      </div>

      <span className="flex-none font-mono text-xs text-[var(--cz-fg-faint)]">{item.when}</span>
    </div>
  );
}
