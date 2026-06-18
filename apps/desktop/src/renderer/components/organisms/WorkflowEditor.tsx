import { useState } from 'react';
import type { Action, Workflow } from '@cockpitzero/shared';
import { Badge } from '../atoms/Badge.js';
import { Button } from '../atoms/Button.js';
import { EmptyState } from '../atoms/EmptyState.js';
import { WorkflowForm } from './WorkflowForm.js';

/**
 * Manages workflows (Level 3): a list with create/edit/delete plus the
 * WorkflowForm for editing a single workflow. Persists via `onChange` — Settings
 * saves the whole config through the main process (which validates it).
 */
export function WorkflowEditor({
  workflows,
  actions,
  onChange,
}: {
  workflows: Workflow[];
  actions: Action[];
  onChange: (workflows: Workflow[]) => void;
}) {
  const [editing, setEditing] = useState<Workflow | 'new' | null>(null);

  const upsert = (workflow: Workflow) => {
    const exists = workflows.some((w) => w.id === workflow.id);
    onChange(
      exists
        ? workflows.map((w) => (w.id === workflow.id ? workflow : w))
        : [...workflows, workflow],
    );
    setEditing(null);
  };
  const remove = (id: string) => onChange(workflows.filter((w) => w.id !== id));

  const stepSummary = (workflow: Workflow) =>
    workflow.steps.map((id) => actions.find((a) => a.id === id)?.title ?? '(deleted)').join(' → ');

  if (editing) {
    return (
      <WorkflowForm
        initial={editing === 'new' ? undefined : editing}
        actions={actions}
        onSubmit={upsert}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Workflows ({workflows.length})</h2>
        <Button variant="primary" onClick={() => setEditing('new')} disabled={actions.length === 0}>
          New workflow
        </Button>
      </div>

      {actions.length === 0 ? (
        <EmptyState
          title="No actions yet"
          hint="Create actions first, then chain them into a workflow."
        />
      ) : workflows.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          hint="Chain several actions into one keyword to set up your whole context."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {workflows.map((workflow) => (
            <li key={workflow.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-fg">{workflow.name}</span>
                  <Badge>
                    {workflow.steps.length} step{workflow.steps.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                <div className="truncate text-xs text-subtle">{stepSummary(workflow)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button onClick={() => setEditing(workflow)}>Edit</Button>
                <Button variant="danger" onClick={() => remove(workflow.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
