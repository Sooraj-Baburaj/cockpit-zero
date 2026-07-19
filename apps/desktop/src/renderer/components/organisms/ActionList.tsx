import type { Action, ActionKind } from '@cockpitzero/shared';
import { actionSubtitle } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { EmptyState } from '../atoms/EmptyState.js';
import { Kbd } from '../atoms/Kbd.js';
import { ActionTypeBadge } from '../molecules/ActionTypeBadge.js';

/** Thin-line glyph per action kind, shown in the row's leading chip. */
const KIND_GLYPH: Record<ActionKind, React.ReactNode> = {
  'open-url': (
    <>
      <path d="M6.5 9.5 12 4M8.5 4H12v3.5" />
      <path d="M12 9.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2.5" />
    </>
  ),
  'open-app': (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1.2" />
    </>
  ),
  'run-command': (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.8" />
      <path d="m5 6.5 2 1.7-2 1.6M8.5 10.2h3" />
    </>
  ),
  snippet: (
    <>
      <path d="M5.7 3.2h4.6a1.2 1.2 0 0 1 1.2 1.2v7.2a1.2 1.2 0 0 1-1.2 1.2H5.7a1.2 1.2 0 0 1-1.2-1.2V4.4a1.2 1.2 0 0 1 1.2-1.2Z" />
      <path d="M6.4 7h3.2M6.4 9.4h3.2" />
    </>
  ),
};

/**
 * Configured actions as clickable rows (click anywhere to edit, per the Facet
 * Console): an inset kind chip, the title + mono target, then the trigger
 * keyword as a keycap and the monochrome type badge. Delete stays a
 * hover-revealed affordance.
 */
export function ActionList({
  actions,
  keywordOf,
  onEdit,
  onDelete,
}: {
  actions: Action[];
  /** The action's launcher trigger keyword (primary alias), if any. */
  keywordOf?: (actionId: string) => string;
  onEdit: (action: Action) => void;
  onDelete: (action: Action) => void;
}) {
  if (actions.length === 0) {
    return <EmptyState title="No actions yet" hint="Create your first action to get started." />;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {actions.map((action) => {
        const keyword = keywordOf?.(action.id) ?? '';
        return (
          <li key={action.id} className="group/action relative">
            <button
              type="button"
              onClick={() => onEdit(action)}
              className="flex w-full items-center justify-between gap-3 rounded-[var(--cz-radius-lg)] px-3 py-[9px] text-left transition-colors hover:bg-[var(--cz-surface-hover)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-[30px] shrink-0 place-items-center rounded-[var(--cz-radius-chip)] border border-border bg-[var(--cz-surface-inset)] text-muted">
                  <svg
                    viewBox="0 0 16 16"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {KIND_GLYPH[action.type]}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium text-fg">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-subtle">
                    {actionSubtitle(action)}
                  </span>
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-2 pr-16">
                {keyword && <Kbd>{keyword}</Kbd>}
                <ActionTypeBadge kind={action.type} />
              </span>
            </button>
            <span className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within/action:opacity-100 group-hover/action:opacity-100">
              <Button variant="danger" size="sm" onClick={() => onDelete(action)}>
                Delete
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
