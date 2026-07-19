import { useEffect, useState } from 'react';
import { ROUTINE_SOURCE_INTEGRATION, RoutineSourceIdSchema } from '@cockpitzero/shared';
import type { ConnectionStatus, Routine, RoutineSourceId } from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { describeSchedule, routineSourceLabel } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { Toggle } from '../atoms/Toggle.js';
import { EmptyState } from '../atoms/EmptyState.js';

/**
 * Console → Routines (Phase 5; sources went real in production P10). Lists the
 * configured routines with an enable toggle (gates the scheduler), a "Run now"
 * button, and a per-routine source picker limited to **connected** integrations
 * — an unconnected source can't be enabled (it would contribute nothing), and
 * its chip points at the Integrations tab instead. Full routine authoring stays
 * in the YAML editor.
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
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null);

  useEffect(() => {
    void api.connectionStatus().then(setConnections);
  }, []);

  /** Whether the integration backing a routine source is connected. */
  const isConnected = (source: RoutineSourceId): boolean => {
    const integration = ROUTINE_SOURCE_INTEGRATION[source];
    if (!integration) return false; // e.g. Teams — no connector yet.
    return connections?.find((c) => c.source === integration)?.connected ?? false;
  };

  const toggle = (id: string, enabled: boolean) =>
    onChange(routines.map((r) => (r.id === id ? { ...r, enabled } : r)));

  const toggleSource = (routine: Routine, source: RoutineSourceId) => {
    const has = routine.sources.includes(source);
    const sources = has
      ? routine.sources.filter((s) => s !== source)
      : [...routine.sources, source];
    onChange(routines.map((r) => (r.id === routine.id ? { ...r, sources } : r)));
  };

  const run = (id: string) => {
    setRunning(id);
    void Promise.resolve(onRun(id)).finally(() => setRunning(null));
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-[19px] leading-none font-semibold text-fg">
          Routines
        </h1>
        <p className="mt-2 max-w-[60ch] text-[13px] text-muted">
          Proactive jobs that run on their own. A routine pulls across your connected tools, then
          summarizes and ranks everything into one briefing — needs you now, can wait, or noise.
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
              className="rounded-[var(--cz-radius-md)] border border-border px-[18px] py-3.5 [background:var(--cz-surface)] [box-shadow:var(--cz-shadow-sm)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[14.5px] font-semibold text-fg">{routine.label}</span>
                    <span className="rounded-[var(--cz-radius-xs)] border border-border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-muted uppercase [background:var(--cz-surface-inset)]">
                      {describeSchedule(routine)}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[12.5px] text-muted">
                    {routine.rankBy === 'recency' ? 'Newest first' : 'Most important first'}
                    {' · '}
                    {routine.sources.length} source{routine.sources.length === 1 ? '' : 's'}
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

              {/* Source picker — only connected integrations can be enabled. */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t [border-color:var(--cz-line-faint)] pt-3">
                {RoutineSourceIdSchema.options.map((source) => {
                  const selected = routine.sources.includes(source);
                  const connected = isConnected(source);
                  const selectable = connected || selected;
                  return (
                    <button
                      key={source}
                      type="button"
                      disabled={!selectable}
                      aria-pressed={selected}
                      title={
                        connected
                          ? undefined
                          : ROUTINE_SOURCE_INTEGRATION[source]
                            ? 'Not connected — connect it in Integrations'
                            : 'No connector available yet'
                      }
                      onClick={() => toggleSource(routine, source)}
                      className={cn(
                        'rounded-[var(--cz-radius-pill)] border px-[11px] py-1 text-[11.5px] font-medium transition',
                        selected
                          ? 'border-[var(--cz-accent-line)] text-fg [background:var(--cz-accent-wash)]'
                          : 'border-border text-muted [background:var(--cz-surface-inset)]',
                        !selectable && 'cursor-not-allowed opacity-45',
                        selectable && !selected && 'hover:text-fg',
                      )}
                    >
                      {routineSourceLabel[source]}
                      {!connected && selected ? ' (disconnected)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="mt-7 border-t [border-color:var(--cz-line-faint)] pt-4 text-[12.5px] text-subtle">
        Local-first · routines pull real notifications from connected integrations in the background
        and never block the launcher.
      </footer>
    </div>
  );
}
