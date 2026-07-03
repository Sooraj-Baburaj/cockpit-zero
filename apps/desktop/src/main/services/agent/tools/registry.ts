import type { z } from 'zod';
import type { AgentToolId, AiToolId, Config } from '@cockpitzero/shared';
import type { MemoryService } from '../memory-service.js';
import type { ToolPorts } from './ports.js';
import { filesRead } from './files-read.js';
import { memoryRecall } from './memory-recall.js';
import { memoryWrite } from './memory-write.js';
import { slidesCreate } from './slides-create.js';

/**
 * The agent tool registry (Phase 7), mirroring the action-runner registry: a
 * mapped type `{ [K in AgentToolId]: Tool<K> }` makes it **exhaustive** — adding a
 * tool id to the shared `AGENT_TOOL_IDS` catalog makes TypeScript error here until
 * an implementation is supplied. Each tool takes injected ports + a per-call
 * context, so the whole set is unit-testable with fakes (no `electron`).
 *
 * Grants are NOT enforced inside a tool — the runner checks `isToolAllowed` before
 * calling, so the gate is in one place (and a tool can't forget it). The tool's
 * `grant` field is descriptive (sourced from the shared `TASK_TOOL_GRANT` map).
 */

/** What a tool returns. `previews` is set by a generative/side-effecting tool
 *  (the result tiles); `detail` overrides the step's planned narration when the
 *  tool has a real signal to show (e.g. "matched 3 prior sessions"). */
export interface ToolResult {
  ok: boolean;
  /** Sub-line to show under the step (overrides the planned detail when present). */
  detail?: string;
  /** Structured output later steps / the result preview can use. */
  data?: unknown;
  /** Result tiles produced by a generative tool (cross-hatch placeholders). */
  previews?: string[];
  error?: string;
}

/** Per-call context handed to every tool. */
export interface ToolContext {
  /** Current config (for any settings-dependent behavior). */
  config: Config;
  /** The local memory store (for the `memory.*` tools). */
  memory: MemoryService;
  /** OS-touching ports (file reads, …). */
  ports: ToolPorts;
}

/** A pluggable capability the agent loop can call. */
export interface Tool {
  id: AgentToolId;
  /** Model-facing description: what the tool does + when to call it. The real agent
   *  loop (production phase 6) feeds this to the AI SDK so the model can choose it. */
  description: string;
  /** Zod schema for the tool input — both the model-facing parameter contract (the
   *  loop hands it to the AI SDK `tool()` as `inputSchema`) and runtime validation. */
  parameters: z.ZodTypeAny;
  /** The permission gating this tool (descriptive; the runner enforces it). */
  grant: AiToolId | 'memory';
  /** Whether running this produces a side-effect that needs review before commit. */
  sideEffecting: boolean;
  /** A not-yet-real external **stub** (its real connector lands in P10). The surface
   *  badges it and the description says so, so stub output is never passed off as
   *  real. Off by default via its grant, per CLAUDE.md ("no mocks in production"). */
  stub?: boolean;
  run(input: unknown, ctx: ToolContext): Promise<ToolResult>;
}

/** The exhaustive registry — one entry per catalog tool id. */
export type ToolRegistry = { [K in AgentToolId]: Tool };

/**
 * The exhaustive registry. The tools are stateless (they take everything via
 * `ToolContext`), so this is a constant map — `ports` aren't needed to build it,
 * but the factory shape mirrors the provider factories and leaves room for a
 * port-bound tool later.
 */
export const TOOL_REGISTRY: ToolRegistry = {
  'files.read': filesRead,
  'memory.recall': memoryRecall,
  'memory.write': memoryWrite,
  'slides.create': slidesCreate,
};

/** Build the registry. Pure: no `electron`, no globals. */
export function createToolRegistry(_ports?: ToolPorts): ToolRegistry {
  return TOOL_REGISTRY;
}
