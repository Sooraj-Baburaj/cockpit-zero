import { useState } from 'react';
import type { Action, ActionKind, DraftMaterialization, Workflow } from '@cockpitzero/shared';
import { Badge } from '../atoms/Badge.js';
import { Button } from '../atoms/Button.js';
import { EmptyState } from '../atoms/EmptyState.js';
import { Sparkle } from '../atoms/Sparkle.js';
import { WorkflowForm } from './WorkflowForm.js';
import { AiWorkflowDrafter } from './AiWorkflowDrafter.js';

/** Thin-line glyph per action kind, drawn on the colourful step tiles. */
const STEP_GLYPH: Record<ActionKind, React.ReactNode> = {
  'open-url': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z" />
    </>
  ),
  'open-app': (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  'run-command': <path d="m5 8 4 4-4 4M12 16h6" />,
  snippet: (
    <>
      <path d="M6 3h9l4 4v14H6Z" />
      <path d="M15 3v4h4M9 12h6M9 16h6" />
    </>
  ),
};

/** One 34px step chip in a workflow card's chain — a Facet inset chip with the
 *  monochrome kind glyph (colour stays reserved for OS icons + the accent). */
function StepTile({ action }: { action?: Action }) {
  return (
    <span
      title={action?.title ?? '(deleted action)'}
      className="grid size-[34px] shrink-0 place-items-center rounded-[var(--cz-radius-chip)] border border-border bg-[var(--cz-surface-inset)] text-muted"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {action ? STEP_GLYPH[action.type] : <path d="M12 9v4M12 16.5v.5M12 3 2.5 20h19L12 3Z" />}
      </svg>
    </span>
  );
}

/** The thin arrow between step tiles. */
function StepArrow() {
  return (
    <span className="shrink-0 text-[var(--cz-fg-faint)]" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        className="block size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

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
        <h2 className="text-[19px] font-semibold">Workflows ({workflows.length})</h2>
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
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {workflows.map((workflow) => (
            <li
              key={workflow.id}
              className="group/wf rounded-[var(--cz-radius-lg)] border border-border bg-surface-2 px-[18px] pt-[18px] pb-5 transition-colors duration-110 hover:bg-[var(--cz-surface-hover)]"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div
                    className="truncate text-[15px] font-semibold text-fg"
                    title={stepSummary(workflow)}
                  >
                    {workflow.name}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition-opacity group-hover/wf:opacity-100 focus-within:opacity-100">
                  <Button variant="outline" size="sm" onClick={() => setEditing(workflow)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(workflow.id)}>
                    Delete
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {workflow.steps.map((id, i) => {
                  const action = actions.find((a) => a.id === id);
                  return (
                    <span key={`${id}-${i}`} className="flex items-center gap-2">
                      {i > 0 && <StepArrow />}
                      <StepTile action={action} />
                    </span>
                  );
                })}
                <Badge className="ml-1">
                  {workflow.steps.length} step{workflow.steps.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
