import type { TaskRun, TaskStep } from '@cockpitzero/shared';
import { taskStatusLabel } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { Sparkle } from '../atoms/Sparkle.js';
import { Button } from '../atoms/Button.js';

/**
 * The agent task surface (Phase 7) — mirrors `ai-task.html`. The intent sits in
 * the search row; a status row carries a pulsing dot + "Working · N of M steps"
 * and a "Using memory · K tools" chip; the step list streams done / running /
 * waiting / blocked markers connected by a thin rail, each with its tool tag,
 * detail, and (while running) an animated progress bar; the result tiles preview
 * what was produced; Stop + a primary CTA (disabled until the result is ready)
 * sit above the footer hints. Presentational — the screen owns the run + actions.
 *
 * One accent moment: the running step (its marker + progress bar). Done stays a
 * neutral green check; waiting/blocked stay muted.
 */
export function TaskSurface({
  run,
  onStop,
  onPrimary,
}: {
  run: TaskRun;
  /** Ghost "Stop" — halts the run (or dismisses once terminal). */
  onStop: () => void;
  /** Primary CTA — approve (at `review`) / open (at `done`). */
  onPrimary: () => void;
}) {
  const active = run.status === 'planning' || run.status === 'working' || run.status === 'review';
  const ready = run.status === 'review' || run.status === 'done';
  const primaryLabel =
    run.status === 'review' ? `Approve & ${lower(run.result?.openLabel ?? 'run')}` : (run.result?.openLabel ?? 'Open');

  return (
    <div className="flex h-full flex-col">
      {/* Intent in the search row. */}
      <div className="flex items-center gap-4 px-[26px] py-[22px]">
        <Sparkle className="size-6 flex-none text-accent" pair />
        <div className="text-[21px] tracking-[-0.01em] text-fg [text-wrap:balance]">{run.intent}</div>
      </div>

      {/* Status row: live pulse + step count, and the memory/tools chip. */}
      <div className="flex items-center justify-between border-t [border-color:var(--cz-line-faint)] px-[26px] py-4">
        <div className="flex items-center gap-[11px]">
          <StatusDot status={run.status} />
          <span className="text-sm font-semibold text-fg">{taskStatusLabel(run)}</span>
        </div>
        {(run.usingMemory || run.toolCount > 0) && (
          <span className="inline-flex items-center gap-[7px] rounded-[var(--cz-radius-full)] border [border-color:var(--cz-line)] px-2.5 py-[5px] text-xs font-medium text-muted [background:var(--cz-glass-2)]">
            <svg
              viewBox="0 0 24 24"
              className="size-3.5 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 4v4h4M12 8v4l3 2" />
            </svg>
            {run.usingMemory ? 'Using memory · ' : ''}
            {run.toolCount} tool{run.toolCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Step checklist. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[26px] pt-1.5 pb-2">
        {run.steps.map((step, i) => (
          <StepRow key={step.id} step={step} first={i === 0} />
        ))}
      </div>

      {/* Result preview tiles. */}
      {run.result && run.result.previews.length > 0 && (
        <div className="flex gap-3 px-[26px] pt-2 pb-1">
          {run.result.previews.map((label, i) => (
            <div
              key={`${label}-${i}`}
              className="grid aspect-[4/3] flex-1 place-items-center rounded-[var(--cz-radius-sm)] border [border-color:var(--cz-line)] [background:repeating-linear-gradient(135deg,var(--cz-bg-1),var(--cz-bg-1)_7px,#f3ebdf_7px,#f3ebdf_14px)]"
            >
              <span className="font-mono text-[10px] tracking-[0.04em] text-subtle">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* The model's closing summary (or a "reached the limit" note). */}
      {run.summary && (
        <div className="px-[26px] pt-2 pb-1 text-[13px] leading-relaxed text-muted [text-wrap:pretty]">
          {run.summary}
        </div>
      )}

      {/* Actions. */}
      <div className="mt-1.5 flex items-center justify-between border-t [border-color:var(--cz-line-faint)] px-[26px] py-4">
        <span className="text-[13px] text-subtle">{actionHint(run)}</span>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={onStop}>
            {active ? 'Stop' : 'Dismiss'}
          </Button>
          <Button variant="dark" onClick={onPrimary} disabled={!ready}>
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
              <rect x="3" y="4" width="18" height="13" rx="1.5" />
              <path d="M12 17v4M8 21h8" />
            </svg>
            {primaryLabel}
          </Button>
        </div>
      </div>

      {/* Footer hints. */}
      <footer className="flex items-center justify-between border-t [border-color:var(--cz-line-faint)] px-[22px] py-3.5">
        <div className="flex items-center gap-4">
          <Hint cap="space" label="stop" />
          <Hint cap="↵" label={run.status === 'review' ? 'approve' : 'preview'} />
          <Hint cap="esc" label="dismiss" />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-subtle">
          COCKPIT ZERO <span className="size-[7px] rounded-full [background:var(--cz-accent)]" />
        </div>
      </footer>
    </div>
  );
}

/** Bottom-line copy that keeps the human-review promise explicit — and honest about
 *  stubs: it never claims a real export happened (the side-effecting tools are still
 *  labeled placeholders until P10). */
function actionHint(run: TaskRun): string {
  switch (run.status) {
    case 'review':
      return 'Approve the highlighted step before it runs — nothing is committed yet.';
    case 'done':
      return 'Done. Read-only steps ran; any committing step ran only with your approval.';
    case 'stopped':
      return 'Stopped. Nothing was committed.';
    case 'error':
      return run.note ?? 'Something needs your attention.';
    default:
      return 'I’ll pause for your approval before any committing step.';
  }
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The status pulse — accent + glow while active, neutral/green/red when settled. */
function StatusDot({ status }: { status: TaskRun['status'] }) {
  const active = status === 'planning' || status === 'working' || status === 'review';
  const color =
    status === 'done'
      ? 'var(--cz-success)'
      : status === 'error'
        ? 'var(--cz-danger)'
        : status === 'stopped'
          ? 'var(--cz-fg-faint)'
          : 'var(--cz-accent)';
  return (
    <span
      className={cn('size-[9px] rounded-full', active && 'motion-safe:animate-pulse')}
      style={{ background: color, boxShadow: active ? 'var(--cz-glow-chip)' : undefined }}
    />
  );
}

/** One step row: marker + title + tool tag + detail + (running) progress bar. */
function StepRow({ step, first }: { step: TaskStep; first: boolean }) {
  return (
    <div className="relative flex items-start gap-3.5 py-[11px]">
      {/* The thin rail linking this marker to the one above. */}
      {!first && (
        <span className="absolute top-0 left-3 h-[11px] w-px [background:var(--cz-line)]" aria-hidden="true" />
      )}
      <Marker step={step} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className={cn(
            'text-[14.5px] font-medium',
            step.state === 'waiting' ? 'text-[var(--cz-fg-subtle)]' : 'text-fg',
          )}
        >
          {step.title}
        </div>
        {(step.tool || step.args || step.detail) && (
          <div className="mt-[3px] space-y-1 font-mono text-[12.5px] text-subtle">
            {(step.tool || step.args || step.stub) && (
              <div className="flex flex-wrap items-center gap-2">
                {step.tool && (
                  <span className="rounded-[var(--cz-radius-xs)] border [border-color:var(--cz-line)] px-[7px] py-px text-muted [background:var(--cz-glass-2)]">
                    {step.tool}
                  </span>
                )}
                {step.stub && (
                  <span
                    className="rounded-[var(--cz-radius-xs)] border border-dashed [border-color:var(--cz-accent-line)] px-[7px] py-px text-[10px] font-semibold tracking-[0.08em] text-[var(--cz-accent-bright)] uppercase"
                    title="A labeled placeholder — its real connector ships later, so no real export happens."
                  >
                    stub
                  </span>
                )}
                {step.args && <span className="min-w-0 break-all text-[var(--cz-fg-subtle)]">{step.args}</span>}
              </div>
            )}
            {step.detail && <div>{step.detail}</div>}
          </div>
        )}
        {step.state === 'running' && (
          <div className="mt-2 h-1 overflow-hidden rounded-full [background:var(--cz-glass-2)]">
            <span
              className="block h-full rounded-full [background:var(--cz-accent-grad)] motion-safe:animate-pulse"
              style={{ width: `${Math.round((step.progress ?? 0.6) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** The 25px state marker (done check / running refresh / waiting dot / blocked ban). */
function Marker({ step }: { step: TaskStep }) {
  if (step.state === 'done') {
    return (
      <MarkerShell className="text-[var(--cz-success)]">
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      </MarkerShell>
    );
  }
  if (step.state === 'running') {
    return (
      <MarkerShell className="text-[var(--cz-accent-bright)] [border-color:var(--cz-accent-line)] [background:var(--cz-accent-soft)]">
        <svg viewBox="0 0 24 24" className="size-3.5 motion-safe:animate-spin [animation-duration:2.4s]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21v-5h5M21 3v5h-5" />
          <path d="M21 8a9 9 0 0 0-15-3.5L3 8M3 16a9 9 0 0 0 15 3.5l3-3.5" />
        </svg>
      </MarkerShell>
    );
  }
  if (step.state === 'blocked') {
    return (
      <MarkerShell className="text-[var(--cz-danger)]">
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m6 6 12 12" />
        </svg>
      </MarkerShell>
    );
  }
  return (
    <MarkerShell className="text-[var(--cz-fg-faint)]">
      <span className="size-[5px] rounded-full [background:var(--cz-fg-faint)]" />
    </MarkerShell>
  );
}

function MarkerShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'grid size-[25px] flex-none place-items-center rounded-full border [border-color:var(--cz-line)] [background:var(--cz-glass-1)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A footer key hint (`.cap` + label) from the mockup. */
function Hint({ cap, label }: { cap: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--cz-radius-xs)] border [border-color:var(--cz-line-strong)] px-1.5 font-mono text-[11px] text-muted [background:var(--cz-glass-2)]">
        {cap}
      </span>
      {label}
    </span>
  );
}
