import { describe, it, expect, vi } from 'vitest';
import { RoutineSchema, type Routine } from '@cockpitzero/shared';
import { createScheduler } from '../src/main/services/routines/scheduler.js';

/**
 * The scheduler is driven by an injected clock + `tick`, so we exercise it with a
 * fake clock here — no timers, no electron. We never call `start()` (which uses a
 * real interval); driving `tick()` directly is the unit under test.
 */

const scheduled: Routine = RoutineSchema.parse({
  id: 'morning_digest',
  label: 'Morning briefing',
  schedule: '0 8 * * *',
  trigger: 'scheduled',
  enabled: true,
});
const onDemand: Routine = RoutineSchema.parse({
  id: 'standup_prep',
  label: 'Standup prep',
  trigger: 'on_demand',
});
const disabled: Routine = RoutineSchema.parse({
  id: 'off',
  label: 'Disabled digest',
  schedule: '0 8 * * *',
  trigger: 'scheduled',
  enabled: false,
});

const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo, d, h, mi).getTime();

describe('createScheduler', () => {
  it('does not fire on the first tick (it only baselines)', () => {
    const run = vi.fn();
    const now = at(2026, 5, 22, 9, 0);
    const sched = createScheduler({ now: () => now, getRoutines: () => [scheduled], run });
    sched.tick();
    expect(run).not.toHaveBeenCalled();
  });

  it('fires a scheduled routine once its cron time passes; on-demand never fires', () => {
    const run = vi.fn();
    let now = at(2026, 5, 22, 9, 0);
    const sched = createScheduler({
      now: () => now,
      getRoutines: () => [scheduled, onDemand],
      run,
    });

    sched.tick(); // baseline at 09:00 on the 22nd
    expect(run).not.toHaveBeenCalled();

    now = at(2026, 5, 23, 8, 0); // next day's 08:00 boundary has passed
    sched.tick();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('morning_digest');
  });

  it('does not fire a disabled routine', () => {
    const run = vi.fn();
    let now = at(2026, 5, 22, 9, 0);
    const sched = createScheduler({ now: () => now, getRoutines: () => [disabled], run });
    sched.tick();
    now = at(2026, 5, 23, 8, 0);
    sched.tick();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs a run missed while asleep on the next wake (once, not per-skip)', () => {
    const run = vi.fn();
    let now = at(2026, 5, 22, 9, 0);
    const sched = createScheduler({ now: () => now, getRoutines: () => [scheduled], run });

    sched.tick(); // baseline
    now = at(2026, 5, 25, 10, 0); // woke 3 days later — three 8:00s were missed
    sched.tick();

    expect(run).toHaveBeenCalledTimes(1); // catches up once, doesn't fire three times

    // A tick right after must not double-fire (lastRun advanced past the boundary).
    sched.tick();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
