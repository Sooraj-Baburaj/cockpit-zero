import { useEffect, type ReactNode } from 'react';
import type { ActionKind, WorkflowDraft } from '@cockpitzero/shared';
import { Badge } from '../atoms/Badge.js';
import { Button } from '../atoms/Button.js';
import { Sparkle } from '../atoms/Sparkle.js';

/**
 * The AI workflow-draft review surface (mirrors `ai-workflow.html`): the echoed
 * description, an "Drafted workflow · N steps" tag, the serif name + mono keyword
 * pill, the numbered/typed step list with a per-step edit affordance, and the
 * Discard / Save footer. Purely presentational — the parent (`AiWorkflowDrafter`)
 * owns the draft state, opens `ActionForm` for an edited step, and materializes
 * the draft on Save. `⌘S` saves and `esc` discards while this view is mounted.
 */
export function WorkflowDraftReview({
  draft,
  description,
  onEditStep,
  onDiscard,
  onSave,
}: {
  draft: WorkflowDraft;
  description: string;
  onEditStep: (index: number) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  // Footer shortcuts: ⌘/Ctrl+S saves, Esc discards. Scoped to this view's
  // lifetime, so it never lingers once the user edits a step or saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDiscard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSave, onDiscard]);

  return (
    <div className="max-w-2xl overflow-hidden rounded-[var(--cz-radius-lg)] border border-border [background:var(--cz-glass-1)] [box-shadow:var(--cz-shadow-md)]">
      {/* The description that produced this draft. */}
      <div className="flex items-start gap-4 px-6 py-5">
        <Sparkle className="mt-0.5 size-6 shrink-0 text-accent" />
        <p className="max-w-[56ch] text-[19px] leading-[1.4] tracking-[-0.01em] text-fg">
          {description}
        </p>
      </div>

      {/* Draft header + name. */}
      <div className="border-t [border-color:var(--cz-line-faint)] px-6 pt-5 pb-1">
        <div className="mb-4 inline-flex items-center gap-[7px] text-[11px] font-semibold tracking-[0.12em] uppercase [color:var(--cz-accent-bright)]">
          <svg
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3 21 7l-9 4-9-4 9-4Z" />
            <path d="m3 12 9 4 9-4" />
          </svg>
          Drafted workflow · {draft.steps.length} step{draft.steps.length === 1 ? '' : 's'}
        </div>
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-[28px] font-medium tracking-[-0.015em] text-fg">
            {draft.name}
          </h2>
          {draft.keyword.trim() !== '' && (
            <span className="rounded-[var(--cz-radius-xs)] border [border-color:var(--cz-line-strong)] [background:var(--cz-glass-2)] px-[9px] py-1 font-mono text-[13px] font-medium text-muted">
              {draft.keyword}
            </span>
          )}
        </div>
      </div>

      {/* Steps. */}
      <ul className="px-6 py-1">
        {draft.steps.map((step, i) => (
          <li
            key={i}
            className="flex items-center gap-[15px] py-[13px] [&+li]:border-t [&+li]:[border-color:var(--cz-line-faint)]"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border [background:var(--cz-glass-2)] font-mono text-[12px] font-semibold text-muted">
              {i + 1}
            </span>
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-2)] text-muted">
              <StepGlyph kind={step.action?.type} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-fg">{step.title}</div>
              {step.target && (
                <div className="mt-0.5 truncate font-mono text-[13px] text-subtle">
                  {step.target}
                </div>
              )}
            </div>
            <Badge>{step.kindLabel}</Badge>
            <button
              type="button"
              onClick={() => onEditStep(i)}
              aria-label={`Edit step ${i + 1}: ${step.title}`}
              className="grid size-[30px] shrink-0 place-items-center rounded-[var(--cz-radius-sm)] [color:var(--cz-fg-faint)] transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 20h4L18 10l-4-4L4 16v4Z" />
                <path d="m13 5 3 3" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {/* Actions. */}
      <div className="flex items-center justify-between gap-4 border-t [border-color:var(--cz-line-faint)] px-6 py-4">
        <span className="flex items-center gap-2 text-[13px] text-subtle">
          <Sparkle className="size-[15px] text-accent" />
          AI drafted · review and edit any step
        </span>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={onDiscard}>
            Discard
          </Button>
          <Button variant="dark" onClick={onSave}>
            <svg
              viewBox="0 0 24 24"
              className="size-[15px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M17 21v-8H7v8M7 3v5h7" />
            </svg>
            Save workflow
          </Button>
        </div>
      </div>

      {/* Footer key hints. */}
      <div className="flex items-center gap-4 border-t [border-color:var(--cz-line-faint)] px-6 py-3 text-[12px] text-muted">
        <Hint cap="⌘S">save</Hint>
        <Hint cap="esc">discard</Hint>
      </div>
    </div>
  );
}

/** Small mono keycap + label, matching the mockup's footer hints. */
function Hint({ cap, children }: { cap: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--cz-radius-xs)] border [border-color:var(--cz-line-strong)] [background:var(--cz-glass-2)] px-1.5 font-mono text-[11px] font-medium text-muted">
        {cap}
      </span>
      {children}
    </span>
  );
}

/** Thin-line glyph per action kind for the step icon chip (falls back to a dot). */
function StepGlyph({ kind }: { kind?: ActionKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[19px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'open-url' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
        </>
      )}
      {kind === 'open-app' && (
        <>
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="8" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </>
      )}
      {kind === 'run-command' && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="m7 9 3 3-3 3M13 15h4" />
        </>
      )}
      {kind === 'snippet' && (
        <>
          <path d="M6 2h9l4 4v16H6Z" />
          <path d="M15 2v4h4M9 13h6M9 17h4" />
        </>
      )}
      {!kind && <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
