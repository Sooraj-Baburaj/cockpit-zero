import {
  applyArguments,
  effectiveArguments,
  valuesToRecord,
  type Action,
} from '@cockpitzero/shared';
import { actionSubtitle } from '../../lib/format.js';
import { ArgumentChip } from '../molecules/ArgumentChip.js';
import { Kbd } from '../atoms/Kbd.js';

/**
 * Level-2 argument-capture panel: shows the matched keyword as a chip, one live
 * segment per declared parameter (the active one carrying the caret), and a
 * one-line preview of the resolved action.
 */
export function ArgumentCapture({
  action,
  keyword,
  values,
  activeIndex,
}: {
  action: Action;
  keyword: string;
  values: string[];
  activeIndex: number;
}) {
  const args = effectiveArguments(action);
  const hasAnyValue = values.some((v) => v.trim() !== '');
  const preview = hasAnyValue
    ? actionSubtitle(applyArguments(action, valuesToRecord(args, values)))
    : null;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2 text-lg">
        <ArgumentChip keyword={keyword} />
        {args.map((arg, i) => {
          const value = values[i] ?? '';
          const active = i === activeIndex;
          return (
            <span key={`${arg.name}-${i}`} className="inline-flex items-center">
              <span className={value ? 'text-fg' : 'text-subtle'}>
                {value || arg.placeholder || arg.name}
              </span>
              {active && (
                <span
                  className="cz-caret ml-px h-5 w-px bg-[var(--cz-accent-bright)]"
                  aria-hidden="true"
                />
              )}
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="truncate font-mono text-sm text-muted">{preview ?? action.title}</span>
        <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
          <Kbd>↵</Kbd> run
        </span>
      </div>
    </div>
  );
}
