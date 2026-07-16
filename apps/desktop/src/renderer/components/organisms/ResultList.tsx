import { Fragment } from 'react';
import type { LauncherItem, LauncherItemKind } from '@cockpitzero/shared';
import { ResultRow } from '../molecules/ResultRow.js';

/** Section heading shown above the first result of each kind. */
const SECTION_LABEL: Record<LauncherItemKind, string> = {
  action: 'Actions',
  workflow: 'Workflows',
  app: 'Applications',
  file: 'Files',
};

/**
 * The scrollable list of launcher results, grouped into labelled sections by
 * kind. `results` is already ordered so each kind is contiguous (see the
 * aggregator), so keyboard navigation stays a simple flat index — the section
 * headers are non-interactive and don't shift the `selected` index.
 */
export function ResultList({
  results,
  selected,
  onSelect,
  onHover,
  listboxId,
}: {
  results: LauncherItem[];
  selected: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  listboxId?: string;
}) {
  return (
    <ul
      id={listboxId}
      role="listbox"
      aria-label="Results"
      className="max-h-80 overflow-y-auto pt-1 pb-1.5"
    >
      {results.map((item, i) => {
        const startsSection = i === 0 || results[i - 1]?.kind !== item.kind;
        return (
          <Fragment key={item.id}>
            {startsSection && (
              <li
                role="presentation"
                className="px-5 pt-3 pb-1 font-mono text-xs font-medium tracking-[var(--cz-tracking-label)] text-subtle uppercase"
              >
                {SECTION_LABEL[item.kind]}
              </li>
            )}
            <ResultRow
              item={item}
              optionId={`cz-opt-${i}`}
              selected={i === selected}
              shortcut={i < 9 ? String(i + 1) : undefined}
              onHover={() => onHover(i)}
              onClick={() => onSelect(i)}
            />
          </Fragment>
        );
      })}
    </ul>
  );
}
