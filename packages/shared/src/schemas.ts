import { z } from 'zod';

/**
 * Zod schemas are the single source of truth for CockpitZero's config shape.
 * All TypeScript types are inferred from these schemas (see ./types.ts) —
 * never hand-write a config type separately.
 */

/** A keystroke-friendly identifier, e.g. "gh" -> "github". */
export const AliasSchema = z.object({
  id: z.string().min(1),
  /** What the user types in the launcher. */
  keyword: z.string().min(1),
  /** Human label shown in results. */
  label: z.string().min(1),
  /** The action id this alias triggers. */
  actionId: z.string().min(1),
});

/**
 * Declares one runtime parameter an action accepts (Level 2 — parameterized
 * actions). The parameter's value is substituted into `{name}` tokens in the
 * action's templated fields. An action may declare several (see `arguments` on
 * `baseActionShape`); the launcher captures them positionally. Example: an
 * `open-url` with `url: "https://github.com/{owner}/{repo}"` and
 * `arguments: [{ name: "owner" }, { name: "repo" }]` turns `gh anthropic claude`
 * into github.com/anthropic/claude.
 */
export const ArgumentSchema = z.object({
  /** Token name referenced as `{name}` in templated fields. */
  name: z.string().min(1).default('query'),
  /** Hint text shown in the launcher while capturing the argument. */
  placeholder: z.string().optional(),
  /** When true, the action only runs once a non-empty argument is given. */
  required: z.boolean().default(true),
});

/**
 * Fields shared by every action member. `arguments` is opt-in; an action without
 * it behaves exactly like a Level-1 static action. Each declared parameter is
 * captured positionally in the launcher and substituted into its `{name}` token.
 * Spread into each union member so the shape stays DRY (discriminated unions
 * can't share a base object).
 */
const baseActionShape = {
  id: z.string().min(1),
  title: z.string().min(1),
  arguments: z.array(ArgumentSchema).optional(),
} as const;

/**
 * A scheme + body URL skeleton, e.g. `https://example.com/x` or `mailto:a@b.c`.
 * Kept as a dependency-free regex so the shared package needs no DOM/Node libs.
 */
const URL_SKELETON = /^[a-z][a-z0-9+.-]*:(\/\/)?[^\s]+$/i;

/**
 * Accepts either a well-formed URL or a templated URL containing `{tokens}`.
 * Tokens are stripped before validation so a template like
 * `https://npmjs.com/package/{query}` validates as a real URL skeleton.
 */
const templatableUrl = () =>
  z.string().refine((value) => URL_SKELETON.test(value.replace(/\{[^}]+\}/g, 'x')), {
    message: 'Must be a valid URL (templates may use {tokens})',
  });

/**
 * Actions are a discriminated union on `type`. To add a new action kind,
 * add a member here, then handle it in the desktop main process and render
 * it in the launcher (see CLAUDE.md → "How to add a new action type").
 */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseActionShape,
    type: z.literal('open-url'),
    url: templatableUrl(),
  }),
  z.object({
    ...baseActionShape,
    type: z.literal('open-app'),
    /** Application name or absolute path. */
    target: z.string().min(1),
  }),
  z.object({
    ...baseActionShape,
    type: z.literal('run-command'),
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
  }),
  z.object({
    ...baseActionShape,
    type: z.literal('snippet'),
    /** Text copied to the clipboard / typed out. */
    content: z.string(),
  }),
]);

/** A workflow chains multiple actions to run in sequence. */
export const WorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1).describe('Ordered list of action ids'),
});

/**
 * One proposed step in an AI-drafted workflow (Phase 4). Either references an
 * existing action (`actionId`) or carries a not-yet-persisted `action` to create
 * on save — the `.refine` guarantees a step is always materializable, so a
 * validated draft can never yield a workflow with a dangling/empty step. The
 * `title` / `target` / `kindLabel` are the review surface's display fields, kept
 * distinct from the action so the AI's human summary (e.g. the `URL ×3` badge)
 * can differ from the materialized action's concrete kind.
 */
export const WorkflowStepDraftSchema = z
  .object({
    /** An existing action id, or null when the step is a newly-proposed action. */
    actionId: z.string().nullable(),
    /** The action to create on save (present when `actionId` is null). */
    action: ActionSchema.optional(),
    /** Step title shown in the review list ("Open dashboards"). */
    title: z.string(),
    /** Mono subtitle under the title ("Datadog · Linear · Stripe"). */
    target: z.string().optional(),
    /** Kind badge ("URL ×3", "Command", "Snippet", "App"). */
    kindLabel: z.string(),
  })
  .refine((step) => step.actionId !== null || step.action !== undefined, {
    message: 'A draft step must reference an existing action or carry one to create.',
  });

/**
 * A workflow proposed from a natural-language description (the `draftWorkflow`
 * channel, Phase 4). Deliberately NOT part of `ConfigSchema` — it's a transient
 * draft, materialized into actions + a `Workflow` on save (see `draftToConfig`).
 * Model/mock output is validated against this before it's ever rendered.
 */
export const WorkflowDraftSchema = z.object({
  /** Serif heading ("Morning routine"). */
  name: z.string(),
  /** Mono keyword pill ("morning") — a suggested handle for the workflow. */
  keyword: z.string(),
  steps: z.array(WorkflowStepDraftSchema).min(1),
});

export const SettingsSchema = z.object({
  /** Electron accelerator string, e.g. "CommandOrControl+J". */
  hotkey: z.string().min(1).default('CommandOrControl+J'),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  /** Frosted-glass translucency for the launcher + settings windows (Appearance). */
  glass: z.boolean().default(true),
  launchAtLogin: z.boolean().default(false),
  telemetryEnabled: z.boolean().default(false),
});

/**
 * Which engine powers AI features. The real set is served through one universal
 * adapter over the Vercel AI SDK (production phase 3), so a BYOP user pastes their
 * own key for any of these. `openai-compatible` covers OpenRouter / Ollama / Together
 * / Fireworks / any custom `baseUrl`. `managed` is the slot for our backend proxy
 * (phase 9, server-routed). `mock` is the offline/deterministic test + CI default and
 * the fresh-install fallback — never a real user's selection once a key is set.
 */
export const AiProviderIdSchema = z.enum([
  'anthropic',
  'openai',
  'google',
  'xai',
  'mistral',
  'groq',
  'cohere',
  'deepseek',
  'openai-compatible',
  'managed',
  'mock',
]);

/**
 * Managed-tier routing knob — `mini` / `pro` map to a cheap vs. frontier model when
 * the backend router picks per request (phase 9, server-side only). It is **not**
 * shown for BYOP users, who pick a concrete `model` directly (see `AiSettingsSchema`).
 * Kept for back-compat + the managed path; `byo` is legacy and no longer surfaced.
 */
export const AiModelTierSchema = z.enum(['mini', 'pro', 'byo']);

/** Tools the assistant may call. Starts as a small catalog; Phase 7 executes them. */
export const AiToolIdSchema = z.enum(['files', 'calendar', 'slack', 'slides-sheets']);

/** The `ai` config block — every AI feature reads its provider/model/toggles here. */
export const AiSettingsSchema = z.object({
  /** Master switch — when false, no AI surface appears anywhere. */
  enabled: z.boolean().default(true),
  /** Provider key. `mock` is offline/deterministic and the test + fresh-install
   *  default; a BYOP user switches it once they paste a key in the vault. */
  provider: AiProviderIdSchema.default('mock'),
  /** Provider-specific model id (e.g. `claude-opus-4-8`, `gpt-5`, `gemini-2.5-pro`).
   *  Free-text so new models work without a release — the Console offers a curated
   *  catalog plus a custom entry. Empty = provider not yet configured (status not ok). */
  model: z.string().default(''),
  /** Only for `openai-compatible` (OpenRouter / Ollama / Together / custom): the
   *  OpenAI-shaped API base URL. Ignored by every other provider. */
  baseUrl: z.string().url().optional(),
  /** Managed-tier routing knob — never shown for BYOP (the user picks `model`). Kept
   *  for the phase-9 managed path + back-compat. See {@link AiModelTierSchema}. */
  modelTier: AiModelTierSchema.default('pro'),
  /** "Ask AI from the bar": when a query matches nothing, offer to ask (Phase 2). */
  askFromBar: z.boolean().default(true),
  /** Memory & history across sessions (the local memory engine, production phase 5,
   *  reads this; off ⇒ no writes and empty recall). */
  memoryEnabled: z.boolean().default(true),
  /** Where memory embeddings come from (production phase 5). `local` = on-device
   *  ONNX (no key, offline); `provider` = the configured AI provider's embedding
   *  model (higher quality, needs a key). Switching source changes the vector
   *  dimension, so it requires a one-time "rebuild memory" (clear + re-embed). */
  embeddingSource: z.enum(['local', 'provider']).default('local'),
  /** Cloud memory sync (production phase 8). **Opt-in** and only meaningful when
   *  signed in: memories sync to the backend pgvector store and recall fuses
   *  local + cloud + knowledge. Off (the default) ⇒ fully local, nothing leaves
   *  the device. Additive default so `version` stays 1. */
  memorySync: z.boolean().default(false),
  /** Per-tool grants for the assistant (Phase 7 enforces). */
  tools: z.array(AiToolIdSchema).default(['files', 'calendar', 'slack']),
  /** Bounded-cost knobs for the real agent loop (production phase 6). Hard caps so a
   *  model-driven run can never spin unbounded: `maxSteps` bounds the model's
   *  tool-use iterations, `maxToolCalls` the total tools executed, `maxTokens` the
   *  cumulative token budget. Additive defaults — an older config parses to these,
   *  so `version` stays 1; power users can raise/lower them in the Console. */
  maxSteps: z.number().int().positive().max(50).default(12),
  maxToolCalls: z.number().int().positive().max(100).default(16),
  maxTokens: z.number().int().positive().default(120_000),
});

/**
 * Sources a routine can pull notifications from (Phase 5). Each maps to a
 * `NotificationSource` adapter in the desktop main process — mock adapters now,
 * real Slack/Gmail/etc. integrations behind the same port later. The id doubles
 * as the digest row's source badge.
 */
export const RoutineSourceIdSchema = z.enum([
  'slack',
  'gmail',
  'teams',
  'linear',
  'github',
  'notion',
]);

/** How a routine's digest decides what to surface first. */
export const RoutineRankBySchema = z.enum(['importance', 'recency']);

/** Where a routine delivers its result. Only `window` (a dedicated briefing
 *  window) is implemented now; `launcher`/`doc` are reserved seams. */
export const RoutineDeliverSchema = z.enum(['launcher', 'window', 'doc']);

/** How a routine fires: on a cron `schedule`, or only when run manually. */
export const RoutineTriggerSchema = z.enum(['scheduled', 'on_demand']);

/** The AI summarize/rank step's knobs (mirrors `summarize.model` /
 *  `summarize.max_items` in the `yaml-config` mockup so Phase 6 can serialize it). */
export const RoutineSummarizeSchema = z.object({
  modelTier: AiModelTierSchema.default('mini'),
  maxItems: z.number().int().positive().default(8),
});

/**
 * A routine — a proactive job that runs on its own (Phase 5). Only the `digest`
 * kind is implemented; the schema is deliberately general so user-authored
 * routine types can slot in later. `enabled` gates the scheduler (a disabled
 * routine never fires on cron, but can still be run manually). Field names are
 * kept aligned with the `routines.yaml` mockup for Phase 6 serialization.
 */
export const RoutineSchema = z.object({
  id: z.string().min(1),
  /** Human label + the digest's heading, e.g. "Morning briefing". */
  label: z.string().min(1),
  /** Only `digest` implemented now; leave room for more kinds. */
  kind: z.literal('digest').default('digest'),
  /** Whether the scheduler fires it (manual "Run now" ignores this). */
  enabled: z.boolean().default(true),
  sources: z.array(RoutineSourceIdSchema).default([]),
  rankBy: RoutineRankBySchema.default('importance'),
  /** Cron expression (5-field); absent = on-demand only (the mockup's standup_prep). */
  schedule: z.string().optional(),
  trigger: RoutineTriggerSchema.default('on_demand'),
  deliver: RoutineDeliverSchema.default('launcher'),
  summarize: RoutineSummarizeSchema.default(RoutineSummarizeSchema.parse({})),
});

/** The full persisted config (what electron-store holds and /sync exchanges). */
export const ConfigSchema = z.object({
  version: z.literal(1).default(1),
  settings: SettingsSchema.default(SettingsSchema.parse({})),
  actions: z.array(ActionSchema).default([]),
  aliases: z.array(AliasSchema).default([]),
  workflows: z.array(WorkflowSchema).default([]),
  /** Additive default: a config written before AI existed parses to this block,
   *  so `version` stays 1 (no migration needed). */
  ai: AiSettingsSchema.default(AiSettingsSchema.parse({})),
  /** Proactive routines (Phase 5). Additive default — old configs parse to `[]`. */
  routines: z.array(RoutineSchema).default([]),
});

export const ActionType = ActionSchema.options.map((o) => o.shape.type.value);
