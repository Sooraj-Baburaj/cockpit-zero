import { useState } from 'react';
import {
  draftToConfig,
  type Action,
  type DraftMaterialization,
  type WorkflowDraft,
} from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { actionSubtitle, actionTypeLabel } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { Sparkle } from '../atoms/Sparkle.js';
import { ActionForm } from './ActionForm.js';
import { WorkflowDraftReview } from './WorkflowDraftReview.js';

/** Example outcomes shown under the description box (echo the mockup's voice). */
const EXAMPLES = [
  'Every morning, open my three dashboards, start a focus timer, and drop standup notes into a doc.',
  'When I start a release: open the changelog, run the deploy script, and post to #launches.',
];

type Phase = 'describe' | 'drafting' | 'review';

/**
 * Drives the AI workflow-draft flow end to end: describe an outcome → `draftWorkflow`
 * → review the typed steps (`WorkflowDraftReview`) → edit any step in the existing
 * `ActionForm` → Save. On Save it materializes the draft into config entities
 * (`draftToConfig`) and hands them up; the parent persists and opens the now-real
 * workflow in the normal editor. Owns only transient draft state — no persistence.
 */
export function AiWorkflowDrafter({
  onSave,
  onCancel,
}: {
  onSave: (result: DraftMaterialization) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('describe');
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = (text: string) => {
    const outcome = text.trim();
    if (outcome === '' || phase === 'drafting') return;
    setDescription(outcome);
    setError(null);
    setPhase('drafting');
    api
      .draftWorkflow(outcome)
      .then((result) => {
        if (result.steps.length === 0) {
          setError('The assistant is unavailable right now. Check Console → AI, then try again.');
          setPhase('describe');
          return;
        }
        setDraft(result);
        setPhase('review');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not draft a workflow.');
        setPhase('describe');
      });
  };

  /** Reflect an edited step's action back into the draft + its display fields. */
  const updateStep = (index: number, action: Action) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((step, i) =>
              i === index
                ? {
                    ...step,
                    actionId: null,
                    action,
                    title: action.title,
                    target: actionSubtitle(action),
                    kindLabel: actionTypeLabel[action.type],
                  }
                : step,
            ),
          }
        : current,
    );
    setEditingStep(null);
  };

  // Editing a step reuses the action form, seeded with the step's proposed action.
  if (draft && editingStep !== null) {
    const step = draft.steps[editingStep];
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h2 className="font-serif text-[22px] font-medium tracking-[-0.015em] text-fg">
            Edit step {editingStep + 1}
          </h2>
          <p className="text-[13px] text-subtle">
            Changes apply to this drafted workflow only — nothing is saved yet.
          </p>
        </div>
        <ActionForm
          initial={step?.action}
          onSubmit={(action) => updateStep(editingStep, action)}
          onCancel={() => setEditingStep(null)}
        />
      </div>
    );
  }

  if (phase === 'review' && draft) {
    return (
      <WorkflowDraftReview
        draft={draft}
        description={description}
        onEditStep={setEditingStep}
        onDiscard={onCancel}
        onSave={() => onSave(draftToConfig(draft))}
      />
    );
  }

  // describe / drafting
  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h2 className="font-serif text-[22px] font-medium tracking-[-0.015em] text-fg">
          Draft a workflow with AI
        </h2>
        <p className="mt-1 max-w-[56ch] text-[13px] text-muted">
          Describe an outcome in plain language. The assistant proposes typed, editable steps you
          can review before saving.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate(description);
        }}
        className="rounded-[var(--cz-radius-lg)] border [border-color:var(--cz-accent-line)] [background:var(--cz-glass-1)] px-[18px] py-4 [box-shadow:var(--cz-shadow-md),var(--cz-glow-accent-soft)]"
      >
        <div className="flex items-start gap-3">
          <Sparkle className="mt-1 size-[22px] shrink-0 text-accent" pair />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Every morning, open my three dashboards, start a focus timer, and drop today’s standup notes into a new doc…"
            aria-label="Describe the workflow"
            rows={2}
            autoFocus
            disabled={phase === 'drafting'}
            className="min-w-0 flex-1 resize-none bg-transparent text-base leading-[1.45] text-fg outline-none placeholder:text-subtle"
            onKeyDown={(e) => {
              // Enter drafts; Shift+Enter inserts a newline.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generate(description);
              }
            }}
          />
          <Button
            type="submit"
            variant="dark"
            disabled={description.trim() === '' || phase === 'drafting'}
          >
            {phase === 'drafting' ? 'Drafting…' : 'Draft'}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--cz-danger)]">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">Try</div>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={phase === 'drafting'}
            onClick={() => generate(example)}
            className="block w-full rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-2)] px-[14px] py-3 text-left text-[13px] text-muted transition hover:text-fg hover:[border-color:var(--cz-accent-line)] disabled:opacity-45"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="mt-6 border-t [border-color:var(--cz-line-faint)] pt-4">
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
