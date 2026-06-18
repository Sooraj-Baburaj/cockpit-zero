import type { LauncherItem } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { itemBadge, itemSubtitle } from '../../lib/format.js';
import { Highlight } from '../../lib/highlight.js';
import { Badge } from '../atoms/Badge.js';
import { ResultIcon } from './ResultIcon.js';

/** A single launcher result: icon, highlighted title, subtitle, and a kind badge. */
export function ResultRow({
  item,
  selected,
  onHover,
  onClick,
}: {
  item: LauncherItem;
  selected: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <li
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 px-5 py-2.5',
        selected && 'bg-surface-2',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ResultIcon kind={item.kind} />
        <div className="min-w-0">
          <div className="truncate text-fg">
            <Highlight text={item.title} ranges={item.matches} />
          </div>
          <div className="truncate text-xs text-subtle">{itemSubtitle(item)}</div>
        </div>
      </div>
      <Badge>{itemBadge(item)}</Badge>
    </li>
  );
}
