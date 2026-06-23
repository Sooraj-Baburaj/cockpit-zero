import { isToolAllowed, isMemoryTool, TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { AgentToolId, AiToolId, Config, TaskRun, TaskStep } from '@cockpitzero/shared';
import type { MemoryService } from './memory-service.js';
import type { TaskPlanner, PlannedStep } from './planner.js';
import type { ToolRegistry, ToolResult } from './tools/registry.js';
import type { ToolPorts } from './tools/ports.js';

/**
 * The agent loop (Phase 7) — the task analogue of the digest runner. Given an
 * intent it plans steps, then walks them: marking each `running` → `done`,
 * calling the planned **tool** through the registry (gated by `isToolAllowed`,
 * never silently run), and streaming a fresh `TaskRun` snapshot on every
 * transition via the injected `emit`. The one side-effecting step pauses the run
 * at `review` — its result is previewed but **nothing is committed** until
 * `approve` (the committing steps run only after). `stop` halts at the next
 * checkpoint (and releases a `review` pause).
 *
 * Fully dependency-inverted — registry, memory, ports, config reader, planner,
 * the `emit` sink, the clock, and the inter-step `delay` are all injected — so it
 * unit-tests in plain Node with fakes and a no-op delay, free of `electron`.
 * "Fast by default": it runs in the background and never blocks the bar.
 */

export interface TaskRunnerDeps {
  registry: ToolRegistry;
  memory: MemoryService;
  ports: ToolPorts;
  /** Read config fresh, so a grant/memory toggle is honored mid-run. */
  getConfig: () => Config;
  plan: TaskPlanner;
  /** Streamed-update sink — production forwards each snapshot to the task window. */
  emit: (run: TaskRun) => void;
  /** Inter-step pause (the visible streaming cadence). Tests inject a no-op. */
  delay?: (ms: number) => Promise<void>;
  stepDelayMs?: number;
  now?: () => number;
  newId?: () => string;
}

export interface TaskRunner {
  /** Start a run from an intent. Returns its id; progress streams via `emit`. */
  start(intent: string): { taskId: string };
  /** The latest snapshot of a run (for `taskGet`), or null if unknown. */
  get(taskId: string): TaskRun | null;
  /** Halt a run (also releases a `review` pause) → `stopped`. */
  stop(taskId: string): { ok: boolean };
  /** Approve a `review` pause, committing the result and running the rest. */
  approve(taskId: string): { ok: boolean };
}

interface RunState {
  run: TaskRun;
  plan: PlannedStep[];
  stopped: boolean;
  /** Resolver for the `review` pause: `true` = approved, `false` = stopped. */
  resolveReview?: (approved: boolean) => void;
}

/** Human label for a grant, for the "enable X to finish" hint. */
const GRANT_LABEL: Record<AiToolId, string> = {
  files: 'Files',
  calendar: 'Calendar',
  slack: 'Slack',
  'slides-sheets': 'Slides & Sheets',
};

/** The hint shown when a tool is blocked by a missing grant / memory toggle. */
function blockedNote(toolId: AgentToolId): string {
  const grant = TASK_TOOL_GRANT[toolId];
  return grant === 'memory'
    ? 'Turn on Memory in Console → AI to let me use your history.'
    : `Enable “${GRANT_LABEL[grant]}” in Console → AI to finish this task.`;
}

const DEFAULT_STEP_DELAY_MS = 700;

/** A serializable deep copy — what crosses IPC and what `get` returns (so a
 *  consumer can never mutate the runner's live state). */
function snapshot(run: TaskRun): TaskRun {
  return {
    ...run,
    steps: run.steps.map((s) => ({ ...s })),
    result: run.result ? { ...run.result, previews: [...run.result.previews] } : undefined,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createTaskRunner({
  registry,
  memory,
  ports,
  getConfig,
  plan,
  emit,
  delay = (ms) => new Promise((r) => setTimeout(r, ms)),
  stepDelayMs = DEFAULT_STEP_DELAY_MS,
  now = () => Date.now(),
  newId = () => `task_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
}: TaskRunnerDeps): TaskRunner {
  const runs = new Map<string, RunState>();

  const push = (state: RunState) => emit(snapshot(state.run));

  /** Build the initial run (status `planning`) from the plan. */
  function build(intent: string): RunState {
    const planned = plan(intent);
    const steps: TaskStep[] = planned.map((ps, i) => ({
      id: `step_${i}`,
      title: ps.title,
      state: 'waiting',
      ...(ps.tool ? { tool: ps.tool } : {}),
    }));

    const toolIds = planned.flatMap((ps) => (ps.tool ? [ps.tool] : []));
    const distinctTools = new Set(toolIds.filter((t) => !isMemoryTool(t)));
    const usesMemoryTool = toolIds.some(isMemoryTool);

    const run: TaskRun = {
      id: newId(),
      intent,
      steps,
      usingMemory: usesMemoryTool && getConfig().ai.memoryEnabled,
      toolCount: distinctTools.size,
      status: 'planning',
    };
    return { run, plan: planned, stopped: false };
  }

  /** Wait for `approve`/`stop` while paused at `review`. */
  function waitForReview(state: RunState): Promise<boolean> {
    if (state.stopped) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      state.resolveReview = resolve;
    });
  }

  /** Settle the run into a terminal status, tidy any interrupted step, emit. */
  function finish(state: RunState, status: TaskRun['status'], note?: string): void {
    if (status === 'stopped') {
      for (const step of state.run.steps) {
        if (step.state === 'running') {
          step.state = 'waiting';
          step.progress = undefined;
        }
      }
    }
    state.run.status = status;
    if (note) state.run.note = note;
    push(state);
  }

  async function loop(state: RunState): Promise<void> {
    try {
      state.run.status = 'working';
      push(state);

      for (let i = 0; i < state.plan.length; i++) {
        if (state.stopped) return finish(state, 'stopped');

        const ps = state.plan[i];
        const step = state.run.steps[i];
        if (!ps || !step) continue; // steps mirror the plan 1:1 (guards the indexer).

        step.state = 'running';
        step.detail = ps.detail;
        if (ps.tool) step.progress = 0.62;
        push(state);

        await delay(stepDelayMs);
        if (state.stopped) return finish(state, 'stopped');

        if (ps.tool) {
          const ai = getConfig().ai;
          if (!isToolAllowed(ps.tool, ai)) {
            // Blocked by a missing grant / memory toggle — never run silently.
            step.state = 'blocked';
            step.progress = undefined;
            step.detail = 'blocked — permission not granted';
            return finish(state, 'error', blockedNote(ps.tool));
          }

          let res: ToolResult;
          try {
            res = await registry[ps.tool].run(ps.input, {
              config: getConfig(),
              memory,
              ports,
            });
          } catch (err) {
            res = { ok: false, error: errorMessage(err) };
          }

          if (!res.ok) {
            step.state = 'blocked';
            step.progress = undefined;
            step.detail = res.error ?? 'tool failed';
            return finish(state, 'error', res.error ?? 'A tool failed.');
          }

          if (res.detail) step.detail = res.detail;
          if (res.previews) {
            state.run.result = {
              kind: 'slides',
              previews: res.previews,
              openLabel: 'Open in Keynote',
            };
          }
        }

        step.progress = undefined;
        step.state = 'done';
        push(state);

        if (ps.review) {
          // Human-in-the-loop: the result is ready but uncommitted. Hold here.
          state.run.status = 'review';
          push(state);
          const approved = await waitForReview(state);
          state.resolveReview = undefined;
          if (!approved) return finish(state, 'stopped');
          state.run.status = 'working';
          push(state);
        }
      }

      // Completion: remember it for next time (no-op when memory is off).
      await memory.write(`Completed task: ${state.run.intent}`, 'task');
      finish(state, 'done');
    } catch (err) {
      finish(state, 'error', errorMessage(err));
    }
  }

  return {
    start(intent) {
      const state = build(intent);
      runs.set(state.run.id, state);
      push(state); // emit the initial `planning` snapshot before the loop runs.
      void loop(state);
      return { taskId: state.run.id };
    },

    get(taskId) {
      const state = runs.get(taskId);
      return state ? snapshot(state.run) : null;
    },

    stop(taskId) {
      const state = runs.get(taskId);
      if (!state) return { ok: false };
      state.stopped = true;
      // Release a `review` pause so the loop can settle into `stopped`.
      state.resolveReview?.(false);
      state.resolveReview = undefined;
      return { ok: true };
    },

    approve(taskId) {
      const state = runs.get(taskId);
      if (!state || state.run.status !== 'review' || !state.resolveReview) return { ok: false };
      const resolve = state.resolveReview;
      state.resolveReview = undefined;
      resolve(true);
      return { ok: true };
    },
  };
}
