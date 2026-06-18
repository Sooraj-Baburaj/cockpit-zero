import type { SearchResult } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { actionSubtitle } from '../../lib/format.js';
import { Highlight } from '../../lib/highlight.js';
import { ActionTypeBadge } from './ActionTypeBadge.js';

/** A single launcher result: highlighted title, subtitle, and a type badge. */
export function ResultRow({
  result,
  selected,
  onHover,
  onClick,
}: {
  result: SearchResult;
  selected: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <li
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 px-5 py-3',
        selected && 'bg-surface-2',
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-fg">
          <Highlight text={result.label} ranges={result.matches} />
        </div>
        <div className="truncate text-xs text-subtle">{actionSubtitle(result.action)}</div>
      </div>
      <ActionTypeBadge kind={result.action.type} />
    </li>
  );
}
