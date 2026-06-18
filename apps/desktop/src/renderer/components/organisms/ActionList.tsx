import type { Action } from '@cockpitzero/shared';
import { actionSubtitle } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { EmptyState } from '../atoms/EmptyState.js';
import { ActionTypeBadge } from '../molecules/ActionTypeBadge.js';

/** Lists configured actions with edit/delete affordances. */
export function ActionList({
  actions,
  onEdit,
  onDelete,
}: {
  actions: Action[];
  onEdit: (action: Action) => void;
  onDelete: (action: Action) => void;
}) {
  if (actions.length === 0) {
    return <EmptyState title="No actions yet" hint="Create your first action to get started." />;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {actions.map((action) => (
        <li key={action.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-fg">{action.title}</span>
              <ActionTypeBadge kind={action.type} />
            </div>
            <div className="truncate text-xs text-subtle">{actionSubtitle(action)}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button onClick={() => onEdit(action)}>Edit</Button>
            <Button variant="danger" onClick={() => onDelete(action)}>
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
