import { useState } from 'react';
import type { Routine } from '@cockpitzero/shared';
import { describeSchedule, routineSourceLabel } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { Toggle } from '../atoms/Toggle.js';
import { EmptyState } from '../atoms/EmptyState.js';

/**
 * Settings → Routines (Phase 5, minimal). Lists the configured routines with an
 * enable toggle (gates the scheduler) and a "Run now" button that computes the
 * digest and opens the briefing window. Full routine authoring is deferred to the
 * YAML editor (Phase 6) — this is the list/toggle/run surface the `cockpit-ai`
 * mockup's nav hints at.
 */
export function RoutinesPanel({
  routines,
  onChange,
  onRun,
}: {
  routines: Routine[];
  onChange: (routines: Routine[]) => void;
  /** Run a routine now — resolves when the digest is computed + delivered. */
  onRun: (routineId: string) => Promise<unknown>;
}) {
  const [running, setRunning] = useState<string | null>(null);

  const toggle = (id: string, enabled: boolean) =>
    onChange(routines.map((r) => (r.id === id ? { ...r, enabled } : r)));

  const run = (id: string) => {
    setRunning(id);
    void Promise.resolve(onRun(id)).finally(() => setRunning(null));
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="font-serif text-[30px] leading-none font-medium tracking-[-0.015em] text-fg">
          Routines
        </h1>
        <p className="mt-2 max-w-[60ch] text-[13px] text-muted">
          Proactive jobs that run on their own. A routine pulls across your tools, then summarizes
          and ranks everything into one briefing — needs you now, can wait, or noise.
        </p>
      </header>

      {routines.length === 0 ? (
        <EmptyState
          title="No routines yet"
          hint="Routines are seeded on first launch; author more in the YAML editor (coming soon)."
        />
      ) : (
        <div className="space-y-2.5">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="flex items-center justify-between gap-4 rounded-[var(--cz-radius-md)] border border-border px-[18px] py-3.5 [background:var(--cz-glass-1)] [box-shadow:var(--cz-shadow-sm)]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14.5px] font-semibold text-fg">{routine.label}</span>
                  <span className="rounded-[var(--cz-radius-xs)] border border-border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-muted uppercase [background:var(--cz-glass-2)]">
                    {describeSchedule(routine)}
                  </span>
                </div>
                <div className="mt-1 truncate text-[12.5px] text-muted">
                  {routine.sources.length > 0
                    ? routine.sources.map((s) => routineSourceLabel[s]).join(' · ')
                    : 'No sources configured'}
                  {' · '}
                  {routine.rankBy === 'recency' ? 'newest first' : 'most important first'}
                </div>
              </div>

              <div className="flex flex-none items-center gap-3.5">
                <Toggle
                  checked={routine.enabled}
                  onChange={(v) => toggle(routine.id, v)}
                  ariaLabel={`Enable ${routine.label}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={running === routine.id}
                  onClick={() => run(routine.id)}
                >
                  {running === routine.id ? 'Running…' : 'Run now'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="mt-7 border-t [border-color:var(--cz-line-faint)] pt-4 text-[12.5px] text-subtle">
        Local-first · routines pull on a schedule in the background and never block the launcher.
      </footer>
    </div>
  );
}
