import { cn } from '../../lib/cn.js';
import { Kbd } from './Kbd.js';

/**
 * A multi-key keyboard shortcut rendered as a row of keycaps (e.g. ⌘ 1, ⌘ ,).
 * `accent` lights the caps — the selected row's run hint.
 */
export function ShortcutChip({
  keys,
  accent = false,
  className,
}: {
  keys: string[];
  accent?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1', className)}>
      {keys.map((k, i) => (
        <Kbd key={i} accent={accent}>
          {k}
        </Kbd>
      ))}
    </span>
  );
}
