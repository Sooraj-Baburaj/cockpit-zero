import type { Digest, Routine } from '@cockpitzero/shared';
import { readConfig } from '../../infra/store.js';
import { createMockSources } from '../../infra/routines/mock-sources.js';
import { aiService } from '../ai/index.js';
import { openDigestWindow } from '../../windows/index.js';
import { createDigestRunner } from './digest-runner.js';
import { createScheduler } from './scheduler.js';

/**
 * The wired routine service the IPC layer + scheduler call (Phase 5). This is the
 * one place that couples the pure digest runner / scheduler to their concrete
 * dependencies — the mock sources, the AI summarizer, the config reader, and the
 * delivery window (mirrors how search-service / ai/index wire their pieces). The
 * pure pieces stay `electron`-free and unit-tested; the `electron` touch
 * (opening the briefing window) lives only here.
 */

// Created once. The digest runner pulls from the mock sources and ranks via the
// AI service; `now` is the real clock (the runner injects it for testability).
const runner = createDigestRunner({
  sources: createMockSources(),
  summarize: (items, opts) => aiService.summarizeDigest(items, opts),
  now: () => Date.now(),
});

/** Last computed digest per routine — what `getDigest` (and the surface) reads. */
const latest = new Map<string, Digest>();

/** Run a routine now: compute its digest, store it, and deliver it. */
export async function runRoutine(routineId: string): Promise<Digest> {
  const routine = readConfig().routines.find((r) => r.id === routineId);
  if (!routine) throw new Error(`Unknown routine: ${routineId}`);

  const digest = await runner.run(routine);
  latest.set(routineId, digest);

  // Delivery: a dedicated briefing window for `window`/`doc` (the implemented
  // target). `launcher` in-bar delivery is a reserved seam.
  if (routine.deliver !== 'launcher') openDigestWindow(routineId);

  return digest;
}

/** The last-computed digest for a routine, or null if it hasn't run this session. */
export function getDigest(routineId: string): Digest | null {
  return latest.get(routineId) ?? null;
}

/** The configured routines (read fresh). */
export function listRoutines(): Routine[] {
  return readConfig().routines;
}

// The cron scheduler reads routines fresh each tick and fires due ones in the
// background (never blocking the launcher). `runRoutine` opens the surface as the
// delivery — a scheduled digest pops the briefing window on its cron.
const scheduler = createScheduler({
  now: () => Date.now(),
  getRoutines: () => readConfig().routines,
  run: (id) => {
    void runRoutine(id).catch((err) =>
      console.error(`[routine] scheduled run failed for ${id}:`, err),
    );
  },
});

/** Start the background scheduler (called once at startup). */
export function startRoutineScheduler(): void {
  scheduler.start();
}

/** Stop the scheduler (e.g. on quit). */
export function stopRoutineScheduler(): void {
  scheduler.stop();
}
