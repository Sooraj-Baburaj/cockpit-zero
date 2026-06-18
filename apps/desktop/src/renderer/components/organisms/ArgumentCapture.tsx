import { applyArgument, type Action } from '@cockpitzero/shared';
import { actionSubtitle } from '../../lib/format.js';
import { ArgumentChip } from '../molecules/ArgumentChip.js';
import { Kbd } from '../atoms/Kbd.js';

/**
 * Level-2 argument-capture panel: shows the matched keyword as a chip, the live
 * argument (or its placeholder), and a one-line preview of the resolved action.
 */
export function ArgumentCapture({
  action,
  keyword,
  argument,
}: {
  action: Action;
  keyword: string;
  argument: string;
}) {
  const placeholder = action.argument?.placeholder ?? 'argument';
  const preview = argument ? actionSubtitle(applyArgument(action, argument)) : null;

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 text-lg">
        <ArgumentChip keyword={keyword} />
        <span className={argument ? 'text-fg' : 'text-subtle'}>{argument || placeholder}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="truncate text-xs text-subtle">{preview ?? action.title}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-subtle">
          <Kbd>↵</Kbd> run
        </span>
      </div>
    </div>
  );
}
