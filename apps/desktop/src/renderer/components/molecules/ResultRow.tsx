import { effectiveArguments, type LauncherItem } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { itemBadge, itemSubtitle } from '../../lib/format.js';
import { Highlight } from '../../lib/highlight.js';
import { modKey } from '../../lib/platform.js';
import { Badge } from '../atoms/Badge.js';
import { Kbd } from '../atoms/Kbd.js';
import { ResultIcon } from './ResultIcon.js';

/** A single launcher result: icon, highlighted title, subtitle, a kind badge,
 *  and either a parameterized-action affordance or a ⌘N quick-run hint. */
export function ResultRow({
  item,
  optionId,
  selected,
  shortcut,
  onHover,
  onClick,
}: {
  item: LauncherItem;
  /** ARIA option id, referenced by the search field's aria-activedescendant. */
  optionId?: string;
  selected: boolean;
  /** The digit for the ⌘N quick-run shortcut (rows 1–9), if any. */
  shortcut?: string;
  onHover: () => void;
  onClick: () => void;
}) {
  // A parameterized action takes one or more arguments; show that affordance
  // instead of the ⌘N hint, since Enter/Tab drills into argument entry rather
  // than running. Multiple parameters are listed in declaration order.
  const argNames = item.kind === 'action' ? effectiveArguments(item.action).map((a) => a.name) : [];
  const argName = argNames.length > 0 ? argNames.join(' ') : null;

  return (
    <li
      id={optionId}
      role="option"
      onMouseEnter={onHover}
      onClick={onClick}
      aria-selected={selected}
      className={cn(
        'group/row relative flex cursor-pointer items-center justify-between gap-3 px-5 py-2.5 transition-colors duration-110',
        selected ? '[background:var(--cz-glass-selected)]' : 'hover:bg-[var(--cz-glass-3)]',
      )}
    >
      {/* sienna left rail on the selected row */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-[9px] bottom-[9px] left-1.5 w-0.5 rounded-[2px] bg-accent transition-opacity duration-200 [box-shadow:var(--cz-rail-glow)]',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className="flex min-w-0 items-center gap-3">
        <ResultIcon item={item} lit={selected} />
        <div className="min-w-0">
          <div className="truncate text-fg">
            <Highlight text={item.title} ranges={item.matches} />
          </div>
          <div className="truncate text-sm text-muted">{itemSubtitle(item)}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {argName ? (
          <span
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]"
            title={`Press Enter or Tab to enter ${argName}`}
          >
            <span aria-hidden="true">↵</span>
            {argName}
          </span>
        ) : (
          shortcut && (
            <Kbd
              className={cn(
                'transition-opacity',
                selected ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-60',
              )}
            >
              {modKey}
              {shortcut}
            </Kbd>
          )
        )}
        <Badge tone={selected ? 'accent' : 'neutral'}>{itemBadge(item)}</Badge>
      </div>
    </li>
  );
}
