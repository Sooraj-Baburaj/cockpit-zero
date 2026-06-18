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
}: {
  results: LauncherItem[];
  selected: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}) {
  return (
    <ul className="max-h-80 overflow-y-auto py-1">
      {results.map((item, i) => {
        const startsSection = i === 0 || results[i - 1]?.kind !== item.kind;
        return (
          <Fragment key={item.id}>
            {startsSection && (
              <li className="px-5 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-subtle uppercase">
                {SECTION_LABEL[item.kind]}
              </li>
            )}
            <ResultRow
              item={item}
              selected={i === selected}
              onHover={() => onHover(i)}
              onClick={() => onSelect(i)}
            />
          </Fragment>
        );
      })}
    </ul>
  );
}
