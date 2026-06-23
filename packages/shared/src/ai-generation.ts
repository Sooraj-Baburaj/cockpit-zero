import { z } from 'zod';
import { WorkflowDraftSchema } from './schemas.js';
import { rankDigestItems } from './routines.js';
import type {
  Action,
  DigestRanking,
  DigestSourceItem,
  DigestSummarizeOptions,
  WorkflowDraft,
} from './types.js';

/**
 * Model-facing schemas for `generateObject` + the pure mappers that turn raw model
 * output into the validated domain shapes the app renders (production phase 3).
 *
 * Why a separate, flatter schema instead of `generateObject({ schema: WorkflowDraftSchema })`?
 * `WorkflowDraftSchema` nests a discriminated-union `ActionSchema`, a `.refine`, and a
 * templated-URL regex — all of which JSON-schema structured output handles poorly and
 * inconsistently across providers. So the model fills a simple `AiWorkflowPlan`, and we
 * map it to a real `WorkflowDraft` here, deterministically. The service still re-validates
 * the result with `WorkflowDraftSchema` (never trust model output — CLAUDE.md). Pure +
 * electron-free, so every mapping edge is assertable in plain Node.
 */

/** The action kinds the assistant may propose for a drafted workflow step. */
export const AI_DRAFT_STEP_KINDS = ['open-url', 'open-app', 'run-command', 'snippet'] as const;

/** One step the model proposes — a flat shape it can reliably fill. */
export const AiWorkflowPlanStepSchema = z.object({
  /** Step title shown in the review list ("Open dashboards"). */
  title: z.string().min(1),
  /** What kind of action this step runs. */
  kind: z.enum(AI_DRAFT_STEP_KINDS),
  /** The action payload, by kind: `open-url` → a URL; `open-app` → an app name/path;
   *  `run-command` → a shell command line; `snippet` → the text to copy. */
  target: z.string().min(1),
  /** Optional mono subtitle for the review row ("Datadog · Linear · Stripe"). */
  subtitle: z.string().optional(),
});

/** The workflow plan the model returns from `draftWorkflow`. */
export const AiWorkflowPlanSchema = z.object({
  /** Serif heading ("Morning routine"). */
  name: z.string().min(1),
  /** Suggested launcher keyword ("morning"). */
  keyword: z.string().min(1),
  steps: z.array(AiWorkflowPlanStepSchema).min(1).max(8),
});

export type AiWorkflowPlan = z.infer<typeof AiWorkflowPlanSchema>;
export type AiWorkflowPlanStep = z.infer<typeof AiWorkflowPlanStepSchema>;

/** Human kind badge for a materialized action, shown in the draft review list. */
const KIND_LABEL: Record<Action['type'], string> = {
  'open-url': 'URL',
  'open-app': 'App',
  'run-command': 'Command',
  snippet: 'Snippet',
};

/** Require a `scheme://` so a model that puts prose in a URL step doesn't produce an
 *  invalid `open-url` (which `templatableUrl` would reject) — we fall back to a snippet. */
const URLISH = /^[a-z][a-z0-9+.-]*:\/\//i;

/** A stable, slug-ish action id from a step title + index. */
function draftActionId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `draft-${base || 'step'}-${index}`;
}

/** Materialize one plan step into a concrete, valid `Action`. */
function planStepToAction(step: AiWorkflowPlanStep, id: string): Action {
  const base = { id, title: step.title };
  switch (step.kind) {
    case 'open-url':
      // Only emit an open-url when the target really is a URL; otherwise keep the
      // text as a snippet so the draft always validates.
      return URLISH.test(step.target.trim())
        ? { ...base, type: 'open-url', url: step.target.trim() }
        : { ...base, type: 'snippet', content: step.target };
    case 'open-app':
      return { ...base, type: 'open-app', target: step.target };
    case 'run-command': {
      const [command, ...args] = step.target.trim().split(/\s+/);
      return { ...base, type: 'run-command', command: command || step.target, args };
    }
    case 'snippet':
      return { ...base, type: 'snippet', content: step.target };
  }
}

/**
 * Map a model's `AiWorkflowPlan` into a validated `WorkflowDraft`. Re-parsed with
 * `WorkflowDraftSchema` so a malformed plan throws here (the service treats that as a
 * failed draft) rather than handing dangling steps to the UI.
 */
export function planToWorkflowDraft(plan: AiWorkflowPlan): WorkflowDraft {
  const steps = plan.steps.map((step, i) => {
    const action = planStepToAction(step, draftActionId(step.title, i));
    return {
      actionId: null,
      title: step.title,
      target: step.subtitle ?? step.target,
      kindLabel: KIND_LABEL[action.type],
      action,
    };
  });
  return WorkflowDraftSchema.parse({ name: plan.name, keyword: plan.keyword, steps });
}

/** One ranked item the model returns from `summarizeDigest`. */
export const AiDigestRankingSchema = z.object({
  /** Must echo the input item's id so we can re-key (unknown ids are dropped). */
  id: z.string(),
  /** One-line summary the digest row renders. */
  summary: z.string(),
  bucket: z.enum(['now', 'wait', 'noise']),
  /** Importance in [0, 1]; clamped on the way in. */
  score: z.number(),
});

/** The digest summary the model returns (wrapped in an object — top-level arrays are
 *  unreliable for structured output across providers). */
export const AiDigestSummarySchema = z.object({
  items: z.array(AiDigestRankingSchema),
});

export type AiDigestSummary = z.infer<typeof AiDigestSummarySchema>;

/**
 * Reconcile a model's digest summary with the input items: always returns exactly one
 * `DigestRanking` per input item, using the model's summary/bucket/score where its id
 * matches, and the deterministic local ranker (`rankDigestItems`) for anything the model
 * missed. This is what makes the real summarize step safe — a partial or hallucinated
 * model response can never drop or invent a row.
 */
export function coerceDigestRankings(
  model: AiDigestSummary,
  items: DigestSourceItem[],
  opts: DigestSummarizeOptions,
): DigestRanking[] {
  const byId = new Map(model.items.map((it) => [it.id, it]));
  // Map over the deterministic fallback (one entry per item, ids in order) so every
  // input is covered; overlay the model's summary/bucket/score where its id matches.
  return rankDigestItems(items, opts).map((fb) => {
    const m = byId.get(fb.id);
    if (!m) return fb;
    const score = Number.isFinite(m.score) ? Math.max(0, Math.min(1, m.score)) : fb.score;
    return {
      id: fb.id,
      summary: m.summary.trim() || fb.summary,
      bucket: m.bucket,
      score: Number(score.toFixed(4)),
    };
  });
}

/**
 * Memory-extraction schemas + coercion (local memory engine, production phase 5).
 * The model turns a raw exchange into **atomic, durable facts** — small, self-
 * contained statements worth remembering across sessions — not a transcript. Kept
 * flat so structured output is reliable across providers; the memory service never
 * trusts raw model output, so it runs every result through {@link coerceMemoryFacts}.
 */

/** Coarse category for a remembered fact (biases recall + how it's surfaced). */
export const AI_MEMORY_FACT_KINDS = [
  'fact',
  'preference',
  'task',
  'event',
  'contact',
  'note',
] as const;

/** One durable fact the model extracts from an exchange. */
export const AiMemoryFactSchema = z.object({
  /** A single, self-contained statement ("Prefers dark mode in the editor"). */
  text: z.string().min(1),
  /** Category — defaults to a plain note when the model omits/garbles it. */
  kind: z.enum(AI_MEMORY_FACT_KINDS).catch('note'),
  /** Salience in [0,1]; clamped on the way in. Defaults mid when missing. */
  importance: z.number().catch(0.5),
});

/** The extraction result the model returns (wrapped — top-level arrays are
 *  unreliable for structured output across providers). */
export const AiMemoryFactsSchema = z.object({
  facts: z.array(AiMemoryFactSchema).max(20),
});

export type AiMemoryFact = z.infer<typeof AiMemoryFactSchema>;
export type AiMemoryFacts = z.infer<typeof AiMemoryFactsSchema>;

/**
 * Validate + normalize raw model extraction output into clean facts: trim text,
 * clamp importance to [0,1], drop empties, and de-duplicate by normalized text.
 * Returns `[]` for anything unparseable, so a hallucinated or malformed response
 * can never inject junk into memory (the service then falls back to its heuristic).
 */
export function coerceMemoryFacts(raw: unknown): AiMemoryFact[] {
  const parsed = AiMemoryFactsSchema.safeParse(raw);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  const out: AiMemoryFact[] = [];
  for (const f of parsed.data.facts) {
    const text = f.text.trim();
    if (text === '') continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const importance = Number.isFinite(f.importance)
      ? Number(Math.max(0, Math.min(1, f.importance)).toFixed(4))
      : 0.5;
    out.push({ text, kind: f.kind, importance });
  }
  return out;
}
