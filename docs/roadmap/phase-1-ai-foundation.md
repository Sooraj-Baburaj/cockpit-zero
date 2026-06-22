# Phase 1 — AI foundation (service · schema · IPC)

> **Status:** 🔜 Next · **Screen:** none (foundation) · **Prerequisite for:** Phases 2, 4, 5, 7.
> **Depends on:** nothing — this is the dependency root.

The backbone every AI feature stands on. No new product screen ships here; instead this phase adds
the **AI provider abstraction**, the **`ai` config block**, and the **IPC channels** that Phases 2,
4, 5, and 7 call. It must be testable with **no API key and no network** via a built-in mock
provider. Keep it small and boring — the value is that it's the one place AI plumbing lives.

## Goal

A renderer component can call `window.api.askAI(prompt)` and get a streamed/resolved answer from a
pluggable AI provider, with the provider, default model, and on/off behavior all driven by a new
`ai` section of the persisted config. Ship a `mock` provider as the default so everything runs in
CI; leave a clearly-marked seam to drop in a real Claude (Anthropic) provider later.

## Scope

**In**

- `ai` block in `ConfigSchema` (provider, model tier, feature toggles, tool grants, memory flag).
- An `AiProvider` **port** (interface) + a `mock` implementation in `infra/`, behind an `AiService`
  in `services/` (dependency-injected, `electron`-free, unit-tested).
- New IPC channels: `askAI`, `draftWorkflow` (stub now, fleshed out in Phase 4), and an `aiStatus`
  read so surfaces can show connected/disabled state.
- Streaming contract decision (see Risks) and a typed `AiAnswer` / `AiSuggestedAction` shape in
  `packages/shared`.
- Unit tests + the IPC contract test passing.

**Out (later phases)**

- Any launcher UI (Phase 2), settings UI (Phase 3), workflow drafting logic (Phase 4), routines
  (Phase 5), memory/tools execution (Phase 7).
- A real network provider. Define the seam; do **not** wire a live API key here.

## Data model & schema changes

`packages/shared/src/schemas.ts` — add an AI block and fold it into `ConfigSchema`:

```ts
/** Which engine tier powers AI features (mirrors the cockpit-ai "Mini / Pro / Bring your own"). */
export const AiModelTier = z.enum(['mini', 'pro', 'byo']);

/** Tools the assistant may call. Start with a small catalog; Phase 7 executes them. */
export const AiToolId = z.enum(['files', 'calendar', 'slack', 'slides-sheets']);

export const AiSettingsSchema = z.object({
  /** Master switch — when false, no AI surface appears anywhere. */
  enabled: z.boolean().default(true),
  /** Provider key. `mock` is offline/deterministic and the test + dev default. */
  provider: z.enum(['mock', 'anthropic']).default('mock'),
  modelTier: AiModelTier.default('pro'),
  /** "Ask AI from the bar": when a query matches nothing, offer to ask (Phase 2). */
  askFromBar: z.boolean().default(true),
  /** Memory & history across sessions (Phase 7 consumes this). */
  memoryEnabled: z.boolean().default(true),
  /** Per-tool grants for the assistant (Phase 7 enforces). */
  tools: z.array(AiToolId).default(['files', 'calendar', 'slack']),
});

// then, inside ConfigSchema:
//   ai: AiSettingsSchema.default(AiSettingsSchema.parse({})),
```

`packages/shared/src/types.ts` — infer + add the answer shapes (the wire types `askAI` returns):

```ts
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type AiModelTier = z.infer<typeof AiModelTier>;
export type AiToolId = z.infer<typeof AiToolId>;

/** One AI-proposed action the launcher can offer to run (Phase 2's "Suggested actions"). */
export interface AiSuggestedAction {
  /** A real action id when it maps to config, else a synthetic preview id. */
  id: string;
  title: string;
  subtitle?: string;
  /** Badge text in the mockup: "Draft" / "App" / "Task". */
  badge?: string;
  /** Optional inline action to materialize/run; null = display-only suggestion. */
  action?: Action;
}

export interface AiAnswer {
  /** The prose answer body (markdown-lite; bold supported). */
  text: string;
  /** Provenance line, e.g. "cockpit-ai · 0.6s · 31 messages read". */
  meta?: string;
  suggestions: AiSuggestedAction[];
}
```

> `ConfigSchema.version` stays `1` if you treat `ai` as an additive default (a config missing `ai`
> parses to the default block). If you'd rather gate it, bump to `2` and add a migration in
> `infra/store.ts`. Additive-default is simpler and matches how `settings` already defaults — prefer
> it unless a migration is needed.

## IPC channels

Follow the four-step recipe (CLAUDE.md → "Adding a new IPC channel"). Add to
`packages/shared/src/ipc.ts`:

```ts
// IpcChannels
askAI: 'ai:ask',
draftWorkflow: 'ai:draft-workflow',   // stub here; Phase 4 implements
aiStatus: 'ai:status',

// IpcApi
/** Ask the assistant a free-text question; resolves to an answer + suggested actions. */
askAI(prompt: string): Promise<AiAnswer>;
/** Draft a workflow from a natural-language description (Phase 4). */
draftWorkflow(description: string): Promise<WorkflowDraft>;   // type lands in Phase 4; stub-return for now
/** Whether AI is enabled + reachable, for surfaces that show connected state. */
aiStatus(): Promise<{ enabled: boolean; provider: string; ok: boolean }>;
```

> **Streaming decision.** The mockups show a typing caret and per-step progress. For Phase 1 keep
> the bridge **promise-based** (`askAI` resolves once) to stay within the structured-clone preload
> limit — simplest and enough for Phase 2's answer reveal. If/when token streaming is wanted, add a
> `askAIStream` channel that pushes chunks via `webContents.send` to a renderer listener registered
> in preload; design that in Phase 7 where it matters most. Document the choice in the PR.

## Main-process work

- `services/ai/provider.ts` — the **port**: `interface AiProvider { ask(prompt, ctx): Promise<AiAnswer>; draftWorkflow(desc, ctx): Promise<WorkflowDraft>; }`. Pure types; no `electron`.
- `infra/ai/mock-provider.ts` — deterministic offline provider. Returns canned but plausible answers
  (reuse the `ai-ask` mockup's copy as the sample). Make output a function of the prompt so tests
  can assert. **This is the default provider.**
- `infra/ai/anthropic-provider.ts` — **seam only**: a file that throws `not configured` unless a key
  is present, with a `// TODO(phase-real-ai)` and a pointer to the `claude-api` skill for model ids
  and the Messages API. Do not commit a key; read from env/secure store when wired.
- `services/ai/ai-service.ts` — `createAiService({ provider, getConfig })`: selects the provider from
  `config.ai.provider`, short-circuits when `config.ai.enabled === false`, and is what `ipc/index.ts`
  calls. Injected provider = unit-testable.
- `ipc/index.ts` — `ipcMain.handle` for `askAI`, `aiStatus`, and a `draftWorkflow` stub.

## Renderer work

Minimal — just enough to prove the channel end-to-end without building Phase 2's UI:

- Extend the dev mock `window.api` in `renderer/lib/api.ts` with `askAI` / `aiStatus` so browser/dev
  mode keeps working (the bridge is dev-gated; don't widen the prod fallback — CLAUDE.md gotcha).
- No new screens. (Optional: a throwaway dev-only button to eyeball a round-trip; remove before merge.)

## Design reference

No screen. But the tokens this foundation's downstream surfaces use — confirm they exist in
`apps/desktop/src/renderer/styles.css`, add any missing ones from `mockups/tokens/`:

- Accent: `--cz-accent #c2652a`, `--cz-accent-bright`, `--cz-accent-soft`, `--cz-accent-line`,
  `--cz-accent-grad`, `--cz-accent-fg`.
- AI "spark" glyph (4-point sparkle) appears in every AI surface — see any mockup's `.spark` SVG
  path. Add it to `ResultIcon`/a shared icon set in Phase 2; just note it here.

## Acceptance criteria

- [ ] `ConfigSchema` parses old configs (no `ai` key) into a valid default `ai` block.
- [ ] `window.api.askAI('…')` resolves an `AiAnswer` with `text` + ≥1 `suggestions` via the mock.
- [ ] `aiStatus()` reflects `config.ai.enabled` and the selected provider.
- [ ] With `ai.enabled = false`, `askAI` resolves a disabled/no-op answer (no throw).
- [ ] `apps/desktop/test/ipc-contract.test.ts` passes (preload ↔ main parity).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` all green.

## Test plan

- `packages/shared/src/schemas` (or a new `ai.test.ts`): `ai` defaults, tool-enum validation,
  old-config-without-ai parses.
- `apps/desktop/test/ai-service.test.ts`: inject a fake provider; assert `askAi` routes to it,
  respects `enabled`, and selects provider by config. Keep `electron`-free.
- Contract test updates for the three new channels.

## Risks / open questions

- **Streaming vs. resolve-once** — decided resolve-once for now (above). Revisit in Phase 7.
- **Where the API key lives** — out of scope here; plan for OS keychain / `safeStorage`, never
  `config.json`. Leave the `anthropic-provider` seam explicit.
- **Model tiers → real model ids** — map `mini`/`pro` to concrete Claude model ids when wiring the
  real provider; consult the `claude-api` skill rather than hard-coding from memory.
- **`WorkflowDraft` type** — fully defined in Phase 4; Phase 1 only needs a stub so the channel
  typechecks. Keep the stub minimal and let Phase 4 own the real shape.
