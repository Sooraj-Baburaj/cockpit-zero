import { describe, it, expect, vi } from 'vitest';
import {
  defaultConfig,
  type AgentToolId,
  type AiToolId,
  type Config,
  type TaskRun,
} from '@cockpitzero/shared';
import { createTaskRunner } from '../src/main/services/agent/task-runner.js';
import type { AgentLoop } from '../src/main/services/agent/agent-loop.js';
import {
  createMemoryService,
  createInMemoryMemoryStore,
} from '../src/main/services/agent/memory-service.js';
import { createHashEmbedder } from '../src/main/services/agent/embedder.js';
import { createToolRegistry } from '../src/main/services/agent/tools/registry.js';

/**
 * The task runner is dependency-inverted (registry + memory + ports + config reader +
 * the agent loop + emit sink + clock), so we drive it with the REAL policy-wrapped
 * tools but a **fake agent loop** — a deterministic tool sequence standing in for the
 * model — plus an in-memory memory store + hash embedder and a fake file port. No
 * electron, no LanceDB, no network. The fake loop calls the runner's policy-wrapped
 * `LoopTool.execute` exactly as the AI SDK would, so grant enforcement, the review
 * gate, the caps, and stop/abort are all exercised through the real runner paths.
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

/** A fake loop that drives the policy-wrapped tools in a fixed order (the model's
 *  job), then returns a summary — mirroring how the real loop's tool calls land. */
function scriptedLoop(
  script: Array<[AgentToolId, unknown]>,
  summary = 'Drafted the deck.',
): AgentLoop {
  return async ({ tools }) => {
    const byId = new Map(tools.map((t) => [t.id, t]));
    for (const [id, input] of script) {
      const tool = byId.get(id);
      if (!tool) throw new Error(`fake loop: unknown tool ${id}`);
      await tool.execute(input);
    }
    return { summary, totalTokens: 42 };
  };
}

const DECK_SCRIPT: Array<[AgentToolId, unknown]> = [
  ['files.read', { path: '~/Documents/q3-brief.pdf' }],
  ['memory.recall', { query: 'revenue standup q3' }],
  ['slides.create', { count: 8, previews: ['title', 'kpis', 'growth', 'next'] }],
];

function harness(config: Config, loop: AgentLoop) {
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
    loop,
    emit: (run) => emits.push(run),
    now: () => 1_000,
    newId: () => 'task_test',
  });

  return { runner, emits, store };
}

const last = (emits: TaskRun[]) => emits[emits.length - 1];

describe('createTaskRunner', () => {
  it('runs a model-chosen plan to a review pause, then completes on approval', async () => {
    const { runner, emits, store } = harness(configWith(), scriptedLoop(DECK_SCRIPT));
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    // The read + recall auto-run; the side-effecting slides.create HOLDS at review,
    // before it executes — nothing produced or committed yet.
    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('review'));

    const review = runner.get(taskId)!;
    expect(review.steps.map((s) => s.state)).toEqual(['done', 'done', 'running']);
    expect(review.steps.map((s) => s.tool)).toEqual([
      'files.read',
      'memory.recall',
      'slides.create',
    ]);
    expect(review.steps[2]?.stub).toBe(true); // the side-effecting tool is a labeled stub
    expect(review.steps[0]?.args).toContain('q3-brief.pdf'); // real per-step args streamed
    expect(review.result).toBeUndefined(); // not produced until the human approves
    expect(review.usingMemory).toBe(true);
    expect(review.toolCount).toBe(1); // files.read so far (slides.create hasn't run)
    expect(await store.all()).toHaveLength(0); // nothing committed yet
    expect(emits.some((r) => r.steps[2]?.state === 'running')).toBe(true);

    runner.approve(taskId);
    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('done'));

    const done = runner.get(taskId)!;
    expect(done.steps.every((s) => s.state === 'done')).toBe(true);
    expect(done.result?.previews).toEqual(['title', 'kpis', 'growth', 'next']);
    expect(done.toolCount).toBe(2); // files.read + slides.create (memory shown separately)
    expect(done.summary).toBe('Drafted the deck.');
    // Completion remembers the task for next time.
    const remembered = await store.all();
    expect(remembered).toHaveLength(1);
    expect(remembered[0]?.text).toContain('Build a deck from the Q3 brief');
    expect(last(emits)?.status).toBe('done');
  });

  it('auto-runs read-only tools to completion with no review gate', async () => {
    const { runner } = harness(
      configWith(),
      scriptedLoop([['files.read', { path: '~/notes.md' }]], 'Read your notes.'),
    );
    const { taskId } = runner.start('What is in my notes?');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('done'));
    const run = runner.get(taskId)!;
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]?.state).toBe('done'); // never paused — reads are safe
    expect(run.summary).toBe('Read your notes.');
  });

  it('blocks a tool whose grant is missing, never running it silently', async () => {
    // No `slides-sheets` grant → slides.create (the 3rd model step) is blocked.
    const { runner } = harness(
      configWith({ tools: ['files', 'calendar', 'slack'] }),
      scriptedLoop(DECK_SCRIPT),
    );
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('error'));

    const run = runner.get(taskId)!;
    expect(run.steps[2]?.tool).toBe('slides.create');
    expect(run.steps[2]?.state).toBe('blocked');
    expect(run.result).toBeUndefined(); // never produced
    expect(run.note).toMatch(/Slides & Sheets/);
  });

  it('blocks memory.recall when memory is off', async () => {
    const { runner, store } = harness(
      configWith({ memoryEnabled: false }),
      scriptedLoop(DECK_SCRIPT),
    );
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('error'));

    const run = runner.get(taskId)!;
    expect(run.steps[1]?.tool).toBe('memory.recall');
    expect(run.steps[1]?.state).toBe('blocked');
    expect(run.usingMemory).toBe(false);
    expect(run.note).toMatch(/Memory/);
    expect(await store.all()).toHaveLength(0);
  });

  it('stop halts the run, aborts the loop, and commits nothing', async () => {
    const aborts: boolean[] = [];
    // A loop that records whether its signal aborted on stop (the model-abort path).
    const loop: AgentLoop = async ({ tools, signal }) => {
      signal.addEventListener('abort', () => aborts.push(true));
      const byId = new Map(tools.map((t) => [t.id, t]));
      for (const [id, input] of DECK_SCRIPT) await byId.get(id)!.execute(input);
      return { summary: 'done', totalTokens: 0 };
    };
    const { runner, store } = harness(configWith(), loop);
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('review'));
    runner.stop(taskId);
    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('stopped'));

    const run = runner.get(taskId)!;
    expect(run.steps[2]?.state).toBe('waiting'); // the running slides.create was reset
    expect(run.result).toBeUndefined();
    expect(await store.all()).toHaveLength(0);
    expect(aborts).toEqual([true]); // stop aborted the in-flight model request
  });

  it('enforces the tool-call cap, ending in a clear state (not a hang)', async () => {
    const config = configWith();
    config.ai.maxToolCalls = 1;
    const { runner } = harness(config, scriptedLoop(DECK_SCRIPT));
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('done'));
    const run = runner.get(taskId)!;
    // Only the first tool ran; the cap stopped the loop before the second call.
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0]?.tool).toBe('files.read');
    expect(run.summary).toMatch(/tool calls/);
  });

  it('shows a connect-a-provider note when no model is configured', async () => {
    const unconfigured: AgentLoop = async () => ({ summary: '', totalTokens: 0, unconfigured: true });
    const { runner, store } = harness(configWith(), unconfigured);
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('error'));
    expect(runner.get(taskId)?.note).toMatch(/Connect a provider/);
    expect(await store.all()).toHaveLength(0); // never wrote a completion memory
  });

  it('surfaces a genuine model error as an error status', async () => {
    const boom: AgentLoop = async () => {
      throw new Error('provider exploded');
    };
    const { runner } = harness(configWith(), boom);
    const { taskId } = runner.start('Build a deck from the Q3 brief');

    await vi.waitFor(() => expect(runner.get(taskId)?.status).toBe('error'));
    expect(runner.get(taskId)?.note).toBe('provider exploded');
  });

  it('approve / stop on an unknown or non-review run is a no-op', () => {
    const { runner } = harness(configWith(), scriptedLoop([]));
    expect(runner.approve('nope')).toEqual({ ok: false });
    expect(runner.stop('nope')).toEqual({ ok: false });
    expect(runner.get('nope')).toBeNull();
  });
});
