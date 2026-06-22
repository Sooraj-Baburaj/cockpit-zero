import type { ReactNode } from 'react';
import type { Digest, DigestItem } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { DigestRow } from '../molecules/DigestRow.js';

/**
 * The routine briefing surface (mirrors `routine-digest.html`): a serif heading
 * with a live "Routine" pulse, the "Needs you now" / "Can wait" groups, and the
 * muted noise roll-up. Items across both groups form one flat, keyboard-navigable
 * list (group headers are skipped) — the parent owns selection + activation; this
 * organism is presentational. The single accent moment is the top "needs you now"
 * item; everything else stays warm-neutral.
 */
export function DigestPanel({
  digest,
  selected,
  listboxId,
  optionId,
  onSelect,
  onHover,
}: {
  digest: Digest;
  /** Flat index of the selected item across [now, wait]. */
  selected: number;
  listboxId: string;
  optionId: (index: number) => string;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}) {
  const { groups } = digest;
  const now = groups.now;
  const wait = groups.wait;

  const renderRow = (item: DigestItem, index: number, top: boolean) => (
    <DigestRow
      key={item.id}
      item={item}
      top={top}
      selected={selected === index}
      optionId={optionId(index)}
      onSelect={() => onSelect(index)}
      onHover={() => onHover(index)}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-4 px-7 pt-7 pb-4">
        <div>
          <h1 className="font-serif text-[34px] leading-[1.05] font-medium tracking-[-0.015em] text-fg">
            {digest.title}
          </h1>
          <div className="mt-2 text-[13px] text-subtle">
            Updated {digest.updatedAt} · {digest.sourceCount} source
            {digest.sourceCount === 1 ? '' : 's'} · {digest.surfaced} of {digest.total} surfaced
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--cz-accent-bright)] uppercase">
          <span className="size-2 rounded-full [background:var(--cz-accent)] [box-shadow:var(--cz-glow-chip)] motion-safe:animate-pulse" />
          Routine
        </span>
      </header>

      <div
        role="listbox"
        id={listboxId}
        aria-label="Digest items"
        aria-activedescendant={selected >= 0 ? optionId(selected) : undefined}
        className="min-h-0 flex-1 overflow-y-auto px-7 pb-2"
      >
        {now.length > 0 && (
          <Group label="Needs you now" count={now.length} accent>
            {now.map((item, i) => renderRow(item, i, i === 0))}
          </Group>
        )}

        {wait.length > 0 && (
          <Group label="Can wait" count={wait.length}>
            {wait.map((item, i) => renderRow(item, now.length + i, false))}
          </Group>
        )}

        {groups.noiseCount > 0 && (
          <div className="my-1.5 flex items-center gap-3 rounded-[var(--cz-radius-md)] border [border-color:var(--cz-line-faint)] px-3.5 py-3.5 [background:var(--cz-glass-2)]">
            <svg
              viewBox="0 0 24 24"
              className="size-[18px] flex-none text-subtle"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
            <span className="text-[13.5px] font-medium text-muted">
              <b className="font-semibold text-fg">
                {groups.noiseCount} low-priority item{groups.noiseCount === 1 ? '' : 's'}
              </b>{' '}
              — newsletters, CI passes, automated digests
            </span>
            <span className="ml-auto text-xs font-medium text-subtle">Muted</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** A digest group header + its rows. The "now" group's label + count carry the
 *  one accent; "wait" stays neutral. */
function Group({
  label,
  count,
  accent = false,
  children,
}: {
  label: string;
  count: number;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="py-1">
      <div className="flex items-center gap-2.5 py-2">
        <span
          className={cn(
            'text-[11px] font-semibold tracking-[0.14em] uppercase',
            accent ? 'text-[var(--cz-accent-bright)]' : 'text-subtle',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'rounded-[var(--cz-radius-full)] border px-2 py-px font-mono text-[11px] font-semibold',
            accent
              ? 'text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]'
              : 'border-border text-muted [background:var(--cz-glass-2)]',
          )}
        >
          {count}
        </span>
        <span className="h-px flex-1 [background:var(--cz-line-faint)]" />
      </div>
      {children}
    </section>
  );
}
