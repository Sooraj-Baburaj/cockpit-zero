import { z } from 'zod';
import type { DigestSourceItem, DigestSummarizeOptions } from './types.js';

/**
 * Managed-inference wire contract (production phase 9). The desktop `managed`
 * provider POSTs an `InferenceRequest` to the backend `/inference` endpoint with
 * the vault session token; the backend's complexity router picks the concrete
 * model (the client never does), calls the provider with **our** key, and either
 * streams NDJSON `InferenceStreamEvent`s back (`task: 'ask'`) or returns one
 * `InferenceObjectResponse` (`task: 'workflow' | 'digest'`). Pure types +
 * schemas — shared so the two sides can never disagree on the wire shape.
 */

/** What the model is being asked to do — drives the system prompt, the router's
 *  complexity hints, and (for object tasks) which schema the output must fit. */
export const InferenceTaskSchema = z.enum(['ask', 'workflow', 'digest']);
export type InferenceTask = z.infer<typeof InferenceTaskSchema>;

/** The `/inference` request body. Deliberately minimal: the client sends *what*
 *  it wants, never a model id or a system prompt — the router decides the model
 *  and the server owns the prompts (abuse containment + the "Auto" contract). */
export const InferenceRequestSchema = z.object({
  task: InferenceTaskSchema.default('ask'),
  /** The full prompt body (for `ask` it may include the recalled-memory block). */
  prompt: z.string().min(1).max(64_000),
});
export type InferenceRequest = z.infer<typeof InferenceRequestSchema>;

/** One NDJSON line of a streamed `ask` response (`application/x-ndjson`). */
export type InferenceStreamEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      /** The concrete model the router selected (surfaced in the answer meta). */
      model: string;
      /** The router's internal tier ('mini' | 'standard' | 'pro'). */
      tier: string;
      inputTokens: number;
      outputTokens: number;
    }
  | { type: 'error'; message: string };

/** The JSON response for object tasks (`workflow` / `digest`). `object` is the
 *  raw structured output — the desktop re-validates it against the task's schema
 *  before use (never trust the wire any more than the model). */
export interface InferenceObjectResponse {
  ok: boolean;
  object?: unknown;
  model?: string;
  tier?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

/** Per-user usage aggregate for the current period (`GET /usage` + the `aiUsage`
 *  IPC read). Billing is deferred — this is the meter a later Stripe phase reads. */
export interface AiUsageSummary {
  ok: boolean;
  /** Calendar month the numbers cover, e.g. `2026-07`. */
  period: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

/**
 * The system prompts for each inference task. Owned here (not per-app) so the
 * managed backend and the desktop BYOP adapter run the **same** prompts — the
 * only difference between tiers is who holds the key and who picks the model.
 */
export const INFERENCE_SYSTEM_PROMPTS: Record<InferenceTask, string> = {
  ask:
    'You are CockpitZero, a fast, keyboard-first desktop assistant. Answer the user ' +
    'concisely and concretely. Prefer short paragraphs and tight bullet points; lead ' +
    'with the answer. You may use light markdown (bold, bullets). Do not invent facts.',
  workflow:
    'You design small automation workflows for a desktop launcher. Given a request, ' +
    'return an ordered list of 1–8 steps. Each step has a short title, a kind ' +
    '(open-url | open-app | run-command | snippet), and a target: a full URL for ' +
    'open-url, an application name for open-app, a shell command line for run-command, ' +
    'or the literal text for snippet. Keep it realistic and minimal.',
  digest:
    'You triage a set of notifications into a morning digest. For each input item return ' +
    'its exact id, a one-line summary, a bucket (now = needs action soon, wait = later, ' +
    'noise = ignorable), and an importance score in [0,1]. Echo every id back exactly once.',
};

/** Compact one-line-per-item prompt body for the digest summarize/rank task —
 *  shared so the BYOP adapter and the managed path feed the model identically. */
export function buildDigestPrompt(items: DigestSourceItem[], opts: DigestSummarizeOptions): string {
  const lines = items
    .map((it) => `- id=${it.id} | ${it.who} via ${it.source} | ${it.ageMinutes}m ago | ${it.text}`)
    .join('\n');
  return (
    `Rank primarily by ${opts.rankBy}. Surface at most ${opts.maxItems} items as now/wait; ` +
    `the rest are noise.\n\n${lines}`
  );
}
