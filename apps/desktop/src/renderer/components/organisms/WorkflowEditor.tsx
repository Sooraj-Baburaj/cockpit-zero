import { useState } from 'react';
import type { Action, DraftMaterialization, Workflow } from '@cockpitzero/shared';
import { Badge } from '../atoms/Badge.js';
import { Button } from '../atoms/Button.js';
import { EmptyState } from '../atoms/EmptyState.js';
import { Sparkle } from '../atoms/Sparkle.js';
import { WorkflowForm } from './WorkflowForm.js';
import { AiWorkflowDrafter } from './AiWorkflowDrafter.js';

/**
 * Manages workflows (Level 3): a list with create/edit/delete plus the
 * WorkflowForm for editing a single workflow. Persists via `onChange` — the
 * Console saves the whole config through the main process (which validates it). When AI
 * is available, a "Draft with AI" entry runs the `AiWorkflowDrafter`: on save it
 * materializes the draft's actions + workflow through `onSaveDraft`, then drops
 * the user into the normal editor on the now-real workflow to keep tweaking.
 */
export function WorkflowEditor({
  workflows,
  actions,
  aiAvailable = false,
  onChange,
  onSaveDraft,
}: {
  workflows: Workflow[];
  actions: Action[];
  /** Whether AI is enabled — gates the "Draft with AI" entry point. */
  aiAvailable?: boolean;
  onChange: (workflows: Workflow[]) => void;
  /** Persist a materialized AI draft (append step actions + the workflow). */
  onSaveDraft: (result: DraftMaterialization) => void;
}) {
  const [editing, setEditing] = useState<Workflow | 'new' | 'draft' | null>(null);

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

  /** Persist the draft, then continue editing the freshly-created workflow. */
  const saveDraft = (result: DraftMaterialization) => {
    onSaveDraft(result);
    setEditing(result.workflow);
  };

  const stepSummary = (workflow: Workflow) =>
    workflow.steps.map((id) => actions.find((a) => a.id === id)?.title ?? '(deleted)').join(' → ');

  if (editing === 'draft') {
    return <AiWorkflowDrafter onSave={saveDraft} onCancel={() => setEditing(null)} />;
  }

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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Workflows ({workflows.length})</h2>
        <div className="flex items-center gap-2">
          {aiAvailable && (
            <Button variant="outline" onClick={() => setEditing('draft')}>
              <Sparkle className="size-4 text-accent" />
              Draft with AI
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => setEditing('new')}
            disabled={actions.length === 0}
          >
            New workflow
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          hint={
            actions.length === 0
              ? aiAvailable
                ? 'Create actions and chain them — or describe an outcome and let AI draft one.'
                : 'Create actions first, then chain them into a workflow.'
              : 'Chain several actions into one keyword to set up your whole context.'
          }
        />
      ) : (
        <ul className="divide-y [divide-color:var(--cz-line-faint)] overflow-hidden rounded-lg border border-border">
          {workflows.map((workflow) => (
            <li
              key={workflow.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-fg">{workflow.name}</span>
                  <Badge>
                    {workflow.steps.length} step{workflow.steps.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                <div className="truncate text-sm text-subtle">{stepSummary(workflow)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setEditing(workflow)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => remove(workflow.id)}>
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
