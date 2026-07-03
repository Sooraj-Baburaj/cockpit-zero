import {
  generateText,
  stepCountIs,
  tool,
  type LanguageModel,
  type StopCondition,
  type ToolSet,
} from 'ai';
import type { AgentToolId } from '@cockpitzero/shared';
import type { z } from 'zod';

/**
 * The real bounded agent loop (production phase 6) — replaces the scripted mock
 * planner. Instead of returning a canned `PlannedStep[]`, the **model** drives the
 * plan: given the intent + recalled memory + the granted tools, it picks tools, the
 * runner executes only the granted ones (and gates side-effecting ones behind the
 * human review), and the loop ends when the model stops or a hard cap trips. No
 * scripted plan — the steps vary with the intent.
 *
 * The AI SDK's tool-calling is the loop engine (we do NOT hand-roll the ReAct loop):
 * `generateText` with `tools` + `stopWhen: stepCountIs(maxSteps)` runs the
 * iterations, and each tool's `execute` delegates to the runner's policy-wrapped
 * {@link LoopTool} — so grant enforcement, the review gate, snapshot streaming, and
 * the caps all live in ONE place (the runner), never inside a tool or at the model's
 * discretion.
 *
 * Dependency-inverted like every other service: `resolveModel` + `generate` are
 * injected, so the runner's tests use a deterministic **fake loop** (no model, no
 * network), while a separate wiring test drives this real loop with the AI SDK's
 * mock model. The loop never touches `electron`.
 */

/**
 * A policy-wrapped tool the loop may call. The runner builds these as closures over
 * the live run: `execute` runs the grant-check → review-gate → registry tool and
 * streams the step snapshots, resolving with a compact, model-facing result, or
 * throwing to end the loop (blocked / stopped / cap reached).
 */
export interface LoopTool {
  id: AgentToolId;
  /** Model-facing description (what it does + when to call it). */
  description: string;
  /** Zod schema for the tool input — handed to the AI SDK as `inputSchema`. */
  parameters: z.ZodTypeAny;
  /** Run the tool under the runner's policy. Resolves with a serializable result
   *  for the model; throws to end the run (blocked / stopped / cap). */
  execute(input: unknown): Promise<unknown>;
}

/** What the runner hands the loop for one run. */
export interface AgentLoopInput {
  intent: string;
  /** The granted, policy-wrapped tools the model may call. */
  tools: LoopTool[];
  /** Compact memory recalled to seed the loop (P5); '' when off / no hits. */
  memoryContext: string;
  /** Wired to `stop` — passed to the model request so a stop **aborts the in-flight
   *  call** (acceptance criterion), not just the next step. */
  signal: AbortSignal;
  /** Hard caps so a run can never go unbounded. */
  maxSteps: number;
  maxTokens: number;
}

/** The loop's outcome. */
export interface AgentLoopOutcome {
  /** The model's closing summary (one or two sentences), or '' if none. */
  summary: string;
  /** Cumulative tokens used across the run (surfaced in the task meta). */
  totalTokens: number;
  /** True when no real tool-calling model is configured (AI off / `mock` / `managed`
   *  / missing key) — the runner shows a "connect a provider" note instead of faking
   *  a run. */
  unconfigured?: boolean;
}

/** A bounded agent loop: intent → model-chosen tool calls → summary. Injected into
 *  the runner so production swaps this real loop for a fake one in tests. */
export type AgentLoop = (input: AgentLoopInput) => Promise<AgentLoopOutcome>;

/** A resolved AI-SDK model + a human label, or null when none is configured. */
export interface ResolvedModel {
  model: LanguageModel;
  label: string;
}

export interface AgentLoopDeps {
  /** Resolve the AI-SDK model for the current config (reads provider + vault key),
   *  or null when AI is off / the provider is `mock`/`managed` / a key is missing —
   *  i.e. when there is no real tool-calling model to drive the loop. */
  resolveModel: () => ResolvedModel | null;
  /** Injectable AI-SDK entry point (tests pass the mock-model runner). */
  generate?: typeof generateText;
}

const SYSTEM_PROMPT =
  'You are CockpitZero’s task agent — a fast, keyboard-first desktop assistant acting ' +
  'on the user’s behalf. Accomplish the task by calling the available tools, one step ' +
  'at a time. Read and look things up freely (files.read, memory.recall); the user must ' +
  'approve any side-effecting tool before it runs, so call it only when you genuinely ' +
  'need it. Save a durable fact with memory.write when you learn something worth keeping. ' +
  'Never fabricate file contents, tool output, or a result you did not get from a tool. ' +
  'When the task is done, reply with one or two sentences summarizing what you did.';

/** Build the user prompt: the intent, plus any recalled memory as grounding context. */
function buildPrompt(intent: string, memoryContext: string): string {
  if (memoryContext.trim() === '') return intent;
  return (
    `Relevant memory from earlier sessions (use only if it helps; ignore otherwise):\n` +
    `${memoryContext}\n\nTask: ${intent}`
  );
}

/** A `stopWhen` that ends the loop once cumulative usage crosses the token budget,
 *  so a chatty model can't burn tokens unbounded (the step cap alone doesn't bound
 *  tokens). Usage fields are optional per provider, so a missing count reads as 0. */
function tokenBudgetReached(maxTokens: number): StopCondition<ToolSet> {
  return ({ steps }) => {
    const used = steps.reduce((sum, s) => sum + (s.usage.totalTokens ?? 0), 0);
    return used >= maxTokens;
  };
}

export function createAgentLoop({
  resolveModel,
  generate = generateText,
}: AgentLoopDeps): AgentLoop {
  return async ({ intent, tools, memoryContext, signal, maxSteps, maxTokens }) => {
    const resolved = resolveModel();
    // No real tool-calling model (AI off / mock / managed / no key) — don't fake a
    // run; let the runner surface the "connect a provider" nudge.
    if (!resolved) return { summary: '', totalTokens: 0, unconfigured: true };

    // Map the runner's policy-wrapped tools → AI-SDK tools. Each `execute` just
    // delegates back to the runner (which enforces grants, the review gate, the
    // caps, and streams snapshots), so the model can never bypass that policy.
    const toolset: ToolSet = {};
    for (const t of tools) {
      toolset[t.id] = tool({
        description: t.description,
        inputSchema: t.parameters,
        execute: (input: unknown) => t.execute(input),
      });
    }

    const result = await generate({
      model: resolved.model,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(intent, memoryContext),
      tools: toolset,
      // The bounded loop: stop at the step cap OR once the token budget is spent.
      stopWhen: [stepCountIs(maxSteps), tokenBudgetReached(maxTokens)],
      // A `stop` aborts the in-flight model request, not just the next iteration.
      abortSignal: signal,
    });

    return { summary: result.text.trim(), totalTokens: result.totalUsage.totalTokens ?? 0 };
  };
}
