import type { SearchResult } from '@cockpitzero/shared';
import { ResultRow } from '../molecules/ResultRow.js';

/** The scrollable list of launcher results. */
export function ResultList({
  results,
  selected,
  onSelect,
  onHover,
}: {
  results: SearchResult[];
  selected: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}) {
  return (
    <ul className="max-h-80 overflow-y-auto py-1">
      {results.map((result, i) => (
        <ResultRow
          key={result.action.id}
          result={result}
          selected={i === selected}
          onHover={() => onHover(i)}
          onClick={() => onSelect(i)}
        />
      ))}
    </ul>
  );
}
