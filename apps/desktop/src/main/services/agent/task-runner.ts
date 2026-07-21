import { isToolAllowed, isMemoryTool, TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { AgentToolId, AiToolId, Config, TaskRun, TaskStep } from '@cockpitzero/shared';
import type { MemoryService } from './memory-service.js';
import type { AgentLoop, LoopTool } from './agent-loop.js';
import type { ToolRegistry, ToolResult } from './tools/registry.js';
import type { ToolPorts } from './tools/ports.js';

/**
 * The agent runner (production phase 6) — drives a real, **model-chosen** plan via
 * the injected {@link AgentLoop}, replacing the scripted walk of a `PlannedStep[]`.
 * It owns ALL policy so the model never bypasses it: for every tool the model picks
 * it appends a step, enforces the grant (`isToolAllowed` → `blocked`, never a silent
 * run), gates side-effecting tools behind the human **review** (nothing is committed
 * until `approve`), counts tool calls against the cap, runs the registry tool, and
 * streams a fresh `TaskRun` snapshot on every transition via the injected `emit`.
 * `stop` halts the loop AND aborts the in-flight model request (via `AbortController`).
 *
 * Fully dependency-inverted — registry, memory, ports, config reader, the loop, the
 * `emit` sink, and the clock are all injected — so it unit-tests in plain Node with a
 * deterministic fake loop, free of `electron` and the network. "Fast by default": it
 * runs in the background and never blocks the bar.
 */

export interface TaskRunnerDeps {
  registry: ToolRegistry;
  memory: MemoryService;
  ports: ToolPorts;
  /** Read config fresh, so a grant/memory/cap toggle is honored mid-run. */
  getConfig: () => Config;
  /** The bounded agent loop (a real model in production, a fake one in tests). */
  loop: AgentLoop;
  /** Streamed-update sink — production forwards each snapshot to the task window. */
  emit: (run: TaskRun) => void;
  now?: () => number;
  newId?: () => string;
}

export interface TaskRunner {
  /** Start a run from an intent. Returns its id; progress streams via `emit`. */
  start(intent: string): { taskId: string };
  /** The latest snapshot of a run (for `taskGet`), or null if unknown. */
  get(taskId: string): TaskRun | null;
  /** Halt a run (also releases a `review` pause + aborts the model) → `stopped`. */
  stop(taskId: string): { ok: boolean };
  /** Approve a `review` pause, letting the side-effecting tool run + the rest finish. */
  approve(taskId: string): { ok: boolean };
}

/** A terminal outcome a tool wrapper records before halting the loop, so the runner
 *  finalizes from a single source of truth (not from how the loop's promise settled). */
interface Terminal {
  status: TaskRun['status'];
  note?: string;
}

interface RunState {
  run: TaskRun;
  stopped: boolean;
  /** Aborts the in-flight model request on `stop`. */
  abort: AbortController;
  /** Distinct non-memory tools used (the "· N tools" count). */
  distinctTools: Set<AgentToolId>;
  /** How many tools have run (checked against `ai.maxToolCalls`). */
  toolCalls: number;
  /** Recorded by a wrapper when a policy condition ends the run; read after settle. */
  terminal?: Terminal;
  /** Resolver for the `review` pause: `true` = approved, `false` = stopped. */
  resolveReview?: (approved: boolean) => void;
}

/** Human label for a grant, for the "enable X to finish" hint. */
const GRANT_LABEL: Record<AiToolId, string> = {
  files: 'Files',
  calendar: 'Calendar',
  slack: 'Slack',
  'slides-sheets': 'Slides & Sheets',
  actions: 'Actions & Workflows',
  apps: 'Apps & Files',
};

/** The hint shown when a tool is blocked by a missing grant / memory toggle. */
function blockedNote(toolId: AgentToolId): string {
  const grant = TASK_TOOL_GRANT[toolId];
  return grant === 'memory'
    ? 'Turn on Memory in Console → AI to let me use your history.'
    : `Enable “${GRANT_LABEL[grant]}” in Console → AI to finish this task.`;
}

/** The note when AI is off or no provider/key is configured — the loop can't run. */
const UNCONFIGURED_NOTE =
  'Connect a provider in Console → AI (choose a model and paste a key) to run tasks.';

/** How many memories to seed the loop with (token-safe — a handful of one-line facts). */
const MEMORY_SEED_LIMIT = 5;

/** Sentinel thrown by a tool wrapper to unwind the model loop once `state.terminal`
 *  (or a stop) is set — the runner reads the recorded outcome, not this error. */
class LoopHalt extends Error {}

/** A serializable deep copy — what crosses IPC and what `get` returns (so a consumer
 *  can never mutate the runner's live state). */
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

/** Compact the model-chosen tool input to one mono line for the step's `args`, so an
 *  autonomous tool call is never opaque (e.g. `path: ~/Documents/q3-brief.pdf`). */
function formatArgs(input: unknown): string | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue;
    const val = Array.isArray(v)
      ? v.join(', ')
      : typeof v === 'object'
        ? JSON.stringify(v)
        : String(v);
    parts.push(`${k}: ${val}`);
  }
  if (parts.length === 0) return undefined;
  const line = parts.join(' · ');
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

export function createTaskRunner({
  registry,
  memory,
  ports,
  getConfig,
  loop,
  emit,
  now = () => Date.now(),
  newId = () => `task_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
}: TaskRunnerDeps): TaskRunner {
  const runs = new Map<string, RunState>();

  const push = (state: RunState) => emit(snapshot(state.run));

  /** Build the initial run (status `planning`, no steps yet — the model adds them). */
  function build(intent: string): RunState {
    const run: TaskRun = {
      id: newId(),
      intent,
      steps: [],
      // Memory is "in play" whenever it's on (we seed context + offer the memory tools).
      usingMemory: getConfig().ai.memoryEnabled,
      toolCount: 0,
      status: 'planning',
    };
    return {
      run,
      stopped: false,
      abort: new AbortController(),
      distinctTools: new Set(),
      toolCalls: 0,
    };
  }

  /** Wait for `approve`/`stop` while paused at `review`. */
  function waitForReview(state: RunState): Promise<boolean> {
    if (state.stopped) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      state.resolveReview = resolve;
    });
  }

  /** Record a terminal outcome and abort the model — the runner finalizes from it. */
  function halt(state: RunState, terminal: Terminal): never {
    state.terminal = terminal;
    state.abort.abort();
    throw new LoopHalt();
  }

  /**
   * Build the policy-wrapped tools handed to the loop. Each `execute` is the single
   * gate the model passes through: stop/cap check → append step → grant check → review
   * (if side-effecting) → run → done, streaming a snapshot at each transition. The
   * model picks WHICH tool and WHEN, but every guarantee lives here, not in the model.
   */
  function buildLoopTools(state: RunState): LoopTool[] {
    return Object.values(registry).map((toolDef) => ({
      id: toolDef.id,
      description: toolDef.description,
      parameters: toolDef.parameters,
      async execute(input: unknown): Promise<unknown> {
        if (state.stopped) halt(state, { status: 'stopped' });

        // Bounded cost: never exceed the configured tool-call cap (end cleanly, not hang).
        const { maxToolCalls } = getConfig().ai;
        if (state.toolCalls >= maxToolCalls) {
          state.run.summary = `Stopped after ${state.toolCalls} tool calls (the configured limit).`;
          halt(state, { status: 'done' });
        }
        state.toolCalls += 1;

        // Append the step the model chose, marked running (the "choosing a tool" beat
        // resolves into a concrete row here).
        const step: TaskStep = {
          id: `step_${state.run.steps.length}`,
          title: toolDef.id,
          tool: toolDef.id,
          state: 'running',
          progress: 0.62,
          ...(formatArgs(input) ? { args: formatArgs(input) } : {}),
        };
        state.run.steps.push(step);
        state.run.status = 'working';
        push(state);

        // Grant enforcement — an ungranted tool is blocked, never silently run.
        if (!isToolAllowed(toolDef.id, getConfig().ai)) {
          step.state = 'blocked';
          step.progress = undefined;
          step.detail = 'blocked — permission not granted';
          halt(state, { status: 'error', note: blockedNote(toolDef.id) });
        }

        // Side-effecting tools hold at `review` BEFORE running: the user approves the
        // action (its args are shown) and nothing is committed until they do. The gate
        // is here, in the runner — never the model's discretion, never inside the tool.
        if (toolDef.sideEffecting) {
          state.run.status = 'review';
          push(state);
          const approved = await waitForReview(state);
          state.resolveReview = undefined;
          if (!approved) halt(state, { status: 'stopped' });
          state.run.status = 'working';
          push(state);
        }

        // Run the tool through the registry (a throw becomes a failed result → blocked).
        let res: ToolResult;
        try {
          res = await toolDef.run(input, { config: getConfig(), memory, ports });
        } catch (err) {
          res = { ok: false, error: errorMessage(err) };
        }
        if (!res.ok) {
          step.state = 'blocked';
          step.progress = undefined;
          step.detail = res.error ?? 'tool failed';
          halt(state, { status: 'error', note: res.error ?? 'A tool failed.' });
        }

        // Done — record the real signal, update the memory/tool counts + any preview.
        if (res.detail) step.detail = res.detail;
        if (isMemoryTool(toolDef.id)) state.run.usingMemory = true;
        else state.distinctTools.add(toolDef.id);
        state.run.toolCount = state.distinctTools.size;
        if (res.previews) {
          state.run.result = {
            kind: 'slides',
            previews: res.previews,
            openLabel: 'Open in Keynote',
          };
        }
        step.progress = undefined;
        step.state = 'done';
        push(state);

        // Hand the model a compact, serializable result (never the raw embedding, etc.).
        return { ok: true, detail: res.detail, data: res.data };
      },
    }));
  }

  /** Seed the loop with memory recalled for the intent (gated; '' when off/empty).
   *  Best-effort — a recall failure must never fail the run. */
  async function seedMemory(intent: string): Promise<string> {
    if (!memory.enabled()) return '';
    try {
      const hits = await memory.recall(intent, MEMORY_SEED_LIMIT);
      return hits.length > 0 ? hits.map((h) => `- ${h.text}`).join('\n') : '';
    } catch {
      return '';
    }
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

  async function run(state: RunState): Promise<void> {
    try {
      state.run.status = 'working';
      push(state);

      const memoryContext = await seedMemory(state.run.intent);
      const ai = getConfig().ai;

      let summary = '';
      try {
        const outcome = await loop({
          intent: state.run.intent,
          tools: buildLoopTools(state),
          memoryContext,
          signal: state.abort.signal,
          maxSteps: ai.maxSteps,
          maxTokens: ai.maxTokens,
        });
        if (outcome.unconfigured) return finish(state, 'error', UNCONFIGURED_NOTE);
        summary = outcome.summary;
      } catch (err) {
        // A wrapper's halt (terminal recorded) or a stop (aborted) unwinds here — both
        // are interpreted below. Only a genuine model/tool error with no recorded
        // outcome surfaces as an error.
        if (!state.terminal && !state.stopped) return finish(state, 'error', errorMessage(err));
      }

      // Single source of truth for the terminal status: a recorded outcome wins, then a
      // stop, else the loop completed normally → done.
      if (state.terminal) return finish(state, state.terminal.status, state.terminal.note);
      if (state.stopped) return finish(state, 'stopped');

      if (summary) state.run.summary = summary;
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
      void run(state);
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
      state.abort.abort(); // interrupt the in-flight model request (acceptance criterion).
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
