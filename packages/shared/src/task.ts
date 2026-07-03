import type { AiToolId } from './types.js';
import type { TaskRun } from './types.js';

/**
 * Pure task/agent helpers (Phase 7) — no React, no `electron`, so they unit-test
 * in plain Node and are shared by the main-process runner and the renderer's task
 * surface. The tool *catalog* lives here (like `ActionKind` lives in the schema,
 * while the action handlers live in the desktop app); the tool *implementations*
 * live in `apps/desktop/src/main/services/agent/tools`.
 */

/**
 * The assistant's tool catalog — the ids the agent loop can call, in the order
 * they appear in the first cut. Read-only `files.read` + the local `memory.*`
 * store are the safe first set; `slides.create` is a local, offline stub that
 * produces preview tiles (the real Slides/Keynote export is a later, external
 * slice — each new tool lands behind its own grant + review).
 */
export const AGENT_TOOL_IDS = [
  'files.read',
  'memory.recall',
  'memory.write',
  'slides.create',
] as const;

/** A tool the agent loop can call. */
export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];

/**
 * Which permission gates each tool: an `ai.tools` grant, or the special `memory`
 * sentinel (gated by `ai.memoryEnabled`, not a per-tool grant). Keeping this map
 * pure means "may the agent call X?" is assertable without a runner or electron.
 */
export const TASK_TOOL_GRANT: Record<AgentToolId, AiToolId | 'memory'> = {
  'files.read': 'files',
  'memory.recall': 'memory',
  'memory.write': 'memory',
  'slides.create': 'slides-sheets',
};

/** The subset of `ai` settings a grant check needs (so callers can pass a slice). */
export interface ToolGrantSettings {
  tools: readonly AiToolId[];
  memoryEnabled: boolean;
}

/**
 * Whether the assistant is permitted to call `toolId` under the current settings.
 * Memory tools require `memoryEnabled`; every other tool requires its `ai.tools`
 * grant. The runner calls this before every tool — a denied tool is blocked, not
 * silently run.
 */
export function isToolAllowed(toolId: AgentToolId, ai: ToolGrantSettings): boolean {
  const grant = TASK_TOOL_GRANT[toolId];
  return grant === 'memory' ? ai.memoryEnabled : ai.tools.includes(grant);
}

/** Whether a tool reads/writes the local memory store (drives the "Using memory" chip). */
export function isMemoryTool(toolId: AgentToolId): boolean {
  return TASK_TOOL_GRANT[toolId] === 'memory';
}

/** The status-row label the surface renders ("Working · 3 of 5 steps"). Derived
 *  from step states so the count tracks the live run. */
export function taskStatusLabel(run: TaskRun): string {
  const total = run.steps.length;
  switch (run.status) {
    case 'planning':
      return 'Planning…';
    case 'working': {
      // The model picks tools as it goes, so early in a run there are no steps yet
      // — surface the "choosing a tool" beat instead of "0 of 0 steps".
      if (total === 0) return 'Choosing a tool…';
      const done = run.steps.filter((s) => s.state === 'done').length;
      const running = run.steps.some((s) => s.state === 'running') ? 1 : 0;
      // "3 of 5" while step 3 runs (2 done + the running one), clamped to [1,total].
      const current = Math.min(Math.max(done + running, 1), total);
      return `Working · ${current} of ${total} steps`;
    }
    case 'review':
      return 'Ready to review';
    case 'done':
      return total === 0 ? 'Done' : `Done · ${total} step${total === 1 ? '' : 's'}`;
    case 'stopped':
      return 'Stopped';
    case 'error':
      return run.note ?? 'Needs attention';
    default: {
      const _never: never = run.status;
      return _never;
    }
  }
}
