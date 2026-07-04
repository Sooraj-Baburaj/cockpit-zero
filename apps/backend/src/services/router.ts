import type { InferenceTask } from '@cockpitzero/shared';

/**
 * The complexity router (P9): a transparent, deterministic heuristic that maps a
 * request → a tier → a concrete model. Managed users never pick a model — this
 * does. The scoring is deliberately simple and tunable (input length, code /
 * structure signals, explicit "think hard" cues, task kind); every decision
 * carries its score so tier choices can be logged and audited. Pure — no env,
 * no db, no network — so it's trivially unit-testable.
 *
 * Tier → model map (Claude ids per the `claude-api` skill; prices $/MTok):
 *   mini     → claude-haiku-4-5   ($1 in / $5 out)   — trivial asks, short lookups
 *   standard → claude-sonnet-5    ($3 in / $15 out)  — everyday asks, drafts, digests
 *   pro      → claude-opus-4-8    ($5 in / $25 out)  — long/complex/code-heavy work
 *
 * Defaulting cheap protects margin (see the phase-9 risk note); the thresholds
 * below are the knobs to tune once real traffic shows the distribution.
 */

/** The router's internal tiers — the v1 Mini/Pro knob survives only here, never
 *  as a user-facing control (managed users see "Auto"). */
export type RouterTier = 'mini' | 'standard' | 'pro';

/** One routing decision, kept alongside the usage row for auditability. */
export interface RouteDecision {
  tier: RouterTier;
  model: string;
  /** The complexity score in [0, 1] that produced the tier (logged). */
  score: number;
}

/** The single place the tier → concrete-model map lives. */
export const TIER_MODELS: Record<RouterTier, string> = {
  mini: 'claude-haiku-4-5',
  standard: 'claude-sonnet-5',
  pro: 'claude-opus-4-8',
};

/** $/million tokens, for the usage row's cost estimate (meter only — billing is
 *  deferred). Keep in sync with the provider's published pricing. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 5, output: 25 },
};

/** Score → tier thresholds (the primary tuning knobs). */
const STANDARD_THRESHOLD = 0.3;
const PRO_THRESHOLD = 0.65;

/** Explicit "spend more brain" cues a user types when the ask is genuinely hard. */
const DEEP_THOUGHT_CUES =
  /\b(think (hard|deeply|carefully|step[- ]by[- ]step)|reason (through|carefully)|prove|derive|in[- ]depth|thorough(ly)?|comprehensive)\b/i;

/** Code-shaped content: fenced blocks, stack traces, or dense symbol soup. */
const CODE_CUES = /```|\bstack ?trace\b|\bexception\b|(=>|::|\{\}|\(\)|;\s*$)/im;

/** Build/analyze/multi-step verbs that usually mean real work, not a lookup. */
const HARD_TASK_CUES =
  /\b(refactor|architect|design|implement|debug|optimi[sz]e|analy[sz]e|compare and|migrate|write (a|the) (plan|spec|essay|report))\b/i;

/**
 * Score a request's complexity in [0, 1]. Transparent by construction: each
 * signal contributes a bounded, documented amount and the result is clamped.
 */
export function scoreComplexity(task: InferenceTask, prompt: string): number {
  let score = 0;

  // Length: 0 at ~0 chars → 0.35 at 4k+ chars (long context usually means more
  // to reason over; recalled-memory blocks and pasted material land here too).
  score += Math.min(prompt.length / 4_000, 1) * 0.35;

  // Explicit depth cues are the strongest single signal — the user asked for it.
  if (DEEP_THOUGHT_CUES.test(prompt)) score += 0.35;

  // Code or hard-task verbs each nudge upward.
  if (CODE_CUES.test(prompt)) score += 0.2;
  if (HARD_TASK_CUES.test(prompt)) score += 0.2;

  // Multi-part asks (several sentences/questions) read as more complex.
  const parts = prompt.split(/[.?!]\s/).filter((p) => p.trim().length > 20).length;
  score += Math.min(Math.max(parts - 2, 0) * 0.04, 0.15);

  // Task priors: workflow drafting + digest ranking are structured, well-bounded
  // jobs a mid model handles well — bias them toward `standard`, never `pro`
  // (the cap protects margin on the high-volume digest path).
  if (task === 'workflow') score = Math.max(score, STANDARD_THRESHOLD);
  if (task === 'digest') score = Math.min(Math.max(score, STANDARD_THRESHOLD), PRO_THRESHOLD - 0.01);

  return Math.min(Math.max(score, 0), 1);
}

/** Map a request to its tier + concrete model (the router's public entry). */
export function routeRequest(task: InferenceTask, prompt: string): RouteDecision {
  const score = scoreComplexity(task, prompt);
  const tier: RouterTier =
    score >= PRO_THRESHOLD ? 'pro' : score >= STANDARD_THRESHOLD ? 'standard' : 'mini';
  return { tier, model: TIER_MODELS[tier], score: Number(score.toFixed(4)) };
}

/** One step down the cost ladder (provider-error fallback), or null at the floor. */
export function cheaperFallback(decision: RouteDecision): RouteDecision | null {
  if (decision.tier === 'mini') return null;
  const tier: RouterTier = decision.tier === 'pro' ? 'standard' : 'mini';
  return { tier, model: TIER_MODELS[tier], score: decision.score };
}

/** USD cost estimate for a completed call (0 for unknown models — meter only). */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICING[model];
  if (!price) return 0;
  const usd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Number(usd.toFixed(6));
}
