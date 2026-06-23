import { describe, it, expect, vi } from 'vitest';
import { defaultConfig, type AiToolId, type Config, type TaskRun } from '@cockpitzero/shared';
import { createTaskRunner } from '../src/main/services/agent/task-runner.js';
import {
  createMemoryService,
  createInMemoryMemoryStore,
} from '../src/main/services/agent/memory-service.js';
import { createHashEmbedder } from '../src/main/services/agent/embedder.js';
import { createToolRegistry } from '../src/main/services/agent/tools/registry.js';
import { createMockPlanner } from '../src/main/services/agent/planner.js';

/**
 * The task runner is dependency-inverted (registry + memory + ports + config
 * reader + planner + emit sink + clock + delay), so we drive it with the REAL
 * scripted plan and tools but an in-memory memory store + hash embedder, a fake
 * file port, a controllable config, and a no-op delay — no electron, no LanceDB,
 * deterministic offline.
 */

function configWith(over: { tools?: AiToolId[]; memoryEnabled?: boolean } = {}): Config {
  const base = defaultConfig();
  return {
    ...base,
    ai: {
      ...base.ai,
      tools: over.tools ?? ['files', 'calendar', 'slack', 'slides-sheets'],
      memoryEnabled: over.memoryEnabled ?? true,
    },
  };
}

function harness(config: Config) {
  const store = createInMemoryMemoryStore();
  const memory = createMemoryService({
    store,
    embedder: createHashEmbedder(),
    extractor: { extract: async () => [] },
    getConfig: () => config,
  });
  const ports = { files: { read: async () => 'KPI sheet: revenue, growth, retention' } };
  const emits: TaskRun[] = [];

  const runner = createTaskRunner({
    registry: createToolRegistry(ports),
    memory,
    ports,
    getConfig: () => config,
    plan: createMockPlanner(),
    emit: (run) => emits.push(run),
    delay: () => Promise.resolve(), // collapse the streaming cadence in tests.
    now: () => 1_000,
    newId: () => 'task_test',
  });

  return { runner, emits, store };
}

const last = (emits: TaskRun[]) => emits[emits.length - 1];

describe('createTaskRunner', () => {
  it('streams the scripted plan to a review pause, then completes on approval', async () => {
    const { runner, emits, store } = harness(configWith());
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    // It runs the read + recall + generate steps, then HOLDS at review (the
    // side-effecting result is ready but nothing is committed).
    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('review'));

    const review = runner.get(taskId)!;
    expect(review.steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'waiting', 'waiting']);
    expect(review.steps[0]?.tool).toBe('files.read');
    expect(review.steps[1]?.tool).toBe('memory.recall');
    expect(review.steps[2]?.tool).toBe('slides.create');
    expect(review.result?.previews).toEqual(['title', 'kpis', 'growth', 'next']);
    expect(review.usingMemory).toBe(true);
    expect(review.toolCount).toBe(2); // files.read + slides.create (memory shown separately)

    // Nothing committed to memory yet (the completion write happens after approval).
    expect(await store.all()).toHaveLength(0);

    // We observed the running marker stream for the slides step at some point.
    expect(emits.some((r) => r.steps[2]?.state === 'running')).toBe(true);

    runner.approve(taskId);
    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('done'));

    const done = runner.get(taskId)!;
    expect(done.steps.every((s) => s.state === 'done')).toBe(true);
    // Completion remembers the task for next time.
    const remembered = await store.all();
    expect(remembered).toHaveLength(1);
    expect(remembered[0]?.text).toContain('Build a deck from the Q3 brief');
    expect(last(emits)?.status).toBe('done');
  });

  it('blocks a tool whose grant is missing, never running it silently', async () => {
    // No `slides-sheets` grant → slides.create (step 3) is blocked.
    const { runner } = harness(configWith({ tools: ['files', 'calendar', 'slack'] }));
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('error'));

    const run = runner.get(taskId)!;
    expect(run.steps[2]?.state).toBe('blocked');
    expect(run.steps[3]?.state).toBe('waiting');
    expect(run.result).toBeUndefined(); // never produced
    expect(run.note).toMatch(/Slides & Sheets/);
  });

  it('blocks memory.recall when memory is off', async () => {
    const { runner, store } = harness(configWith({ memoryEnabled: false }));
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('error'));

    const run = runner.get(taskId)!;
    expect(run.steps[1]?.state).toBe('blocked'); // memory.recall
    expect(run.usingMemory).toBe(false);
    expect(run.note).toMatch(/Memory/);
    expect(await store.all()).toHaveLength(0);
  });

  it('stop halts the run and commits nothing', async () => {
    const { runner, store } = harness(configWith());
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('review'));
    runner.stop(taskId);
    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('stopped'));

    const run = runner.get(taskId)!;
    // The committing steps never ran; memory was never written.
    expect(run.steps[3]?.state).toBe('waiting');
    expect(run.steps[4]?.state).toBe('waiting');
    expect(await store.all()).toHaveLength(0);
  });

  it('approve / stop on an unknown or non-review run is a no-op', () => {
    const { runner } = harness(configWith());
    expect(runner.approve('nope')).toEqual({ ok: false });
    expect(runner.stop('nope')).toEqual({ ok: false });
    expect(runner.get('nope')).toBeNull();
  });
});
