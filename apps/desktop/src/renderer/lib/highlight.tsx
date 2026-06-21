import { Fragment } from 'react';

/**
 * Renders `text` with the given `[start, end)` ranges emphasized — used to show
 * which characters of a result matched the query (ranges come from fzf via the
 * shared search layer).
 */
export function Highlight({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, start)}</Fragment>);
    parts.push(
      <mark
        key={`m${i}`}
        className="bg-transparent font-semibold text-[var(--cz-accent-bright)]"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}
