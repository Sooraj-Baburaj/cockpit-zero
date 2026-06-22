import { nextCronRun } from '@cockpitzero/shared';
import type { Routine } from '@cockpitzero/shared';

/**
 * The routine scheduler (Phase 5) — pure with respect to `electron` and injectable
 * for a fake clock. It evaluates scheduled routines on a coarse `tick` (the
 * production wiring drives `tick` from a 60s interval). On each tick a scheduled,
 * enabled routine whose next cron time has passed since it last ran is fired.
 *
 * This deliberately compares "next run after lastRun" against now rather than
 * matching the exact minute, so a run missed while the machine was asleep fires on
 * the next wake instead of being silently skipped (CLAUDE.md: keep it simple but
 * correct). It never blocks the launcher — runs happen in the background.
 */

export interface SchedulerDeps {
  /** Current time (epoch ms). */
  now: () => number;
  /** The current routines (read fresh so config edits take effect). */
  getRoutines: () => Routine[];
  /** Fire a routine by id (production wires this to the routine service's runner). */
  run: (routineId: string) => void;
}

export interface Scheduler {
  /** Evaluate routines and fire any that are due. */
  tick(): void;
  /** Begin ticking on an interval (default 60s). No-op if already started. */
  start(intervalMs?: number): void;
  /** Stop the interval. */
  stop(): void;
}

const DEFAULT_INTERVAL_MS = 60_000;

export function createScheduler({ now, getRoutines, run }: SchedulerDeps): Scheduler {
  /** Last time each routine was fired (or its baseline when first seen). */
  const lastRun = new Map<string, number>();
  let timer: ReturnType<typeof setInterval> | null = null;

  function isScheduled(r: Routine): boolean {
    return r.enabled && r.trigger === 'scheduled' && typeof r.schedule === 'string';
  }

  function tick(): void {
    const t = now();
    for (const routine of getRoutines()) {
      if (!isScheduled(routine)) continue;

      // First time we see a routine, baseline it to "now" so it doesn't fire
      // immediately on startup — only on its next genuine cron boundary.
      const last = lastRun.get(routine.id);
      if (last === undefined) {
        lastRun.set(routine.id, t);
        continue;
      }

      const next = nextCronRun(routine.schedule as string, last);
      if (next !== null && next <= t) {
        lastRun.set(routine.id, t);
        run(routine.id);
      }
    }
  }

  return {
    tick,
    start(intervalMs = DEFAULT_INTERVAL_MS) {
      if (timer) return;
      tick(); // establish baselines immediately
      timer = setInterval(tick, intervalMs);
      // Don't keep the process alive just for the scheduler (Node-only; harmless
      // when unavailable in tests since `start` isn't called there).
      timer.unref?.();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
