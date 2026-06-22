# Production Phase 3 — Universal provider layer (BYOP, real)

> **Status:** 🔜 Next · **Depends on:** P2 (secrets vault) · **Blocks:** P4 (streaming), P5
> (extraction/embeddings can reuse it), P6 (agent), P9 (managed provider slots in here).
> **Risk:** high — this is the heart of "no more mocks".

Replace the offline `mock`/throwing-`anthropic` providers with a **real, universal** AI layer driven
by the **Vercel AI SDK**. A free user pastes **their own** key for **any** major provider (Claude,
OpenAI, Gemini, Grok) or any OpenAI-compatible endpoint (OpenRouter, Ollama, custom), picks a model,
and the assistant works — no login, fully local config, keys in the P2 vault.

## Goal

`window.api.askAI(...)`, `draftWorkflow(...)`, and `summarizeDigest(...)` all run against the user's
chosen real provider through one adapter. Provider + model are config; the key is in the vault.
The kept `mock` provider remains **only** for tests/CI. `aiStatus()` reflects "key present &
provider reachable".

## Locked decisions honored

- **Vercel AI SDK** as the single abstraction (`generateText`/`streamText`/`generateObject`).
- Keys via the **P2 secrets vault** — never `config.json`, never the renderer.
- BYOP users **pick their own model** directly. The old `mini`/`pro` tier picker is **not** used for
  BYOP (it returns for *managed* users in P9, server-side only). See "Schema changes".

## Scope

**In**

- Expand `AiProviderIdSchema` to the real set; add `model` (+ optional `baseUrl` for
  openai-compatible) to the `ai` config; deprecate user-facing `modelTier` for BYOP.
- One `infra/ai/sdk-provider.ts` that implements the existing `AiProvider` port for **all** AI-SDK
  providers (parameterized by provider id + model), reading the key from the vault.
- Real `ask` (generateText / structured), `draftWorkflow` (`generateObject` against
  `WorkflowDraftSchema`), `summarizeDigest` (`generateObject` against the digest ranking schema).
- A small **model catalog** in `shared` (known model ids per provider) to populate the Console picker —
  plus a free-text override for openai-compatible.
- Console "Cockpit AI" panel: provider picker → model picker → masked API-key field (P2) →
  live connection check. Remove the disabled "Bring your own" segment (BYOP is now the whole point).
- Keep `mock` provider for tests; make a real provider the default once a key is set (mock only when
  no key/`NODE_ENV=test`).

**Out**

- Token streaming UI (P4 — keep resolve-once here; `generateText` is fine).
- Memory/RAG context injection into prompts (P5 wires `recall` into `ask`).
- Agent tool-use loop (P6).
- The `managed` provider that calls our backend (P9) — but **leave the enum slot** for it.

## Packages to add (catalog them in `pnpm-workspace.yaml`)

```
ai                          # Vercel AI SDK core
@ai-sdk/anthropic
@ai-sdk/openai
@ai-sdk/google
@ai-sdk/xai                 # Grok
@ai-sdk/openai-compatible   # OpenRouter / Ollama / custom baseURL
```

> These run in the **main process** (Node) only — keys never reach the renderer. No native binaries,
> so no electron rebuild needed; ensure they're bundled/externalized correctly by electron-vite.

## Data model & schema changes

`packages/shared/src/schemas.ts` — redesign the provider part of `AiSettingsSchema`:

```ts
/** Real providers. `mock` stays for tests/CI only; `managed` (our backend proxy) lands in P9. */
export const AiProviderIdSchema = z.enum([
  'anthropic', 'openai', 'google', 'xai', 'openai-compatible', 'managed', 'mock',
]);

export const AiSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  provider: AiProviderIdSchema.default('mock'),          // becomes a real one once a key is set
  /** Provider-specific model id (e.g. a Claude/GPT/Gemini/Grok id). Free-text so new
   *  models work without a release; the Console offers a catalog + custom entry. */
  model: z.string().default(''),
  /** Only for `openai-compatible` (OpenRouter/Ollama/custom). */
  baseUrl: z.string().url().optional(),
  askFromBar: z.boolean().default(true),
  memoryEnabled: z.boolean().default(true),
  tools: z.array(AiToolIdSchema).default(['files', 'calendar', 'slack']),
  // modelTier: kept ONLY for managed routing/back-compat — not shown for BYOP. See P9.
  modelTier: AiModelTierSchema.default('pro'),
});
```

> **Migration.** Adding `model`/`baseUrl` is additive (defaults), so `version` can stay `1`. If you
> want old configs that had `provider:'anthropic'` (the throwing seam) to not auto-select a now-real
> provider with an empty model, add a tiny normalizer in `infra/store.ts`: when `provider` is real
> but `model` is empty, treat the provider as unconfigured (status `ok:false`) — don't bump version.

Consult the **`claude-api` skill** for current Claude model ids; do not hard-code from memory. For the
catalog, store a *short* curated list per provider and always allow custom text.

`packages/shared/src/ai-models.ts` (new) — `MODEL_CATALOG: Record<AiProviderId, {id,label}[]>` and a
`defaultModelFor(provider)` helper. Pure; the Console reads it.

## IPC channels

No new channels for the happy path — `askAI`/`draftWorkflow`/`aiStatus` already exist and keep their
signatures. Optionally add:

```ts
listModels: 'ai:list-models',   // returns MODEL_CATALOG (or live-fetched for openai-compatible)
```

`aiStatus()` keeps its shape but `ok` now means "enabled, key present in vault, model set, and a
1-token reachability probe succeeded (cached briefly)".

## Main-process work

- `infra/ai/sdk-provider.ts` — `createSdkProvider({ getKey })` returns an `AiProvider`:
  - Map `config.ai.provider` → the AI SDK model factory:
    `anthropic(model)`, `openai(model)`, `google(model)`, `xai(model)`,
    `createOpenAICompatible({ baseURL })(model)`. Inject the key from the vault (`getKey(provider)` →
    `SecretsService.get(SecretName.providerKey(provider))`).
  - `ask`: `generateText` (or `generateObject` if we want structured suggestions) → map to `AiAnswer`.
    Build `meta` from real usage (provider · latency · token counts).
  - `draftWorkflow`: `generateObject({ schema: WorkflowDraftSchema, prompt })` → **still** re-validate
    with `WorkflowDraftSchema.parse` in `ai-service.ts` (never trust model output).
  - `summarizeDigest`: `generateObject` against the digest ranking schema; on error fall back to the
    deterministic `rankDigestItems` (the service already does this when disabled — keep that safety).
  - `ready(ctx)`: synchronous — key present in vault AND `model` set. (The live reachability probe is
    a separate cached async used by `aiStatus`, not `ready`.)
- `services/ai/ai-service.ts` — `providers` map gains the SDK provider; selection by `config.ai.provider`.
  Remove the always-throwing anthropic seam (the SDK provider handles anthropic now). Keep `mock`.
- `services/ai/index.ts` — wire the singleton with the secrets `getKey`.
- The default provider resolution: if no key is configured for any provider, fall back to `mock` so a
  fresh install still renders (with a "connect a provider" nudge), but **never** ship mock as the
  selected provider once a key exists.

## Renderer work

- Rewrite the Console "Cockpit AI" panel (`organisms/AiPanel.tsx`):
  - **Provider** dropdown (Claude / OpenAI / Gemini / Grok / OpenAI-compatible). Use the `Dropdown`
    molecule (no native `<select>`).
  - **Model** dropdown from `MODEL_CATALOG[provider]` + a "custom…" free-text. For openai-compatible,
    also a **Base URL** field.
  - **API key** field = the P2 masked secret field, keyed to the selected provider.
  - Replace the old `mini/pro/byo` `SegmentedControl` for BYOP. (Keep the component; managed reuses
    the *idea* server-side in P9 — but the BYOP panel no longer shows tiers.)
  - Connection pill from `aiStatus()` — "Connected · Claude" / "Add a key to connect".
- Update `renderer/lib/api.ts` dev mock for any new channel (`listModels`).

## Acceptance criteria

- [ ] With a real OpenAI/Anthropic/Google/xAI key in the vault and a model selected, `askAI('…')`
      returns a real model answer; switching provider in the Console takes effect with no restart.
- [ ] `draftWorkflow` returns a schema-valid `WorkflowDraft` from a real model (validated again in the
      service).
- [ ] An openai-compatible endpoint (e.g. OpenRouter or local Ollama) works via `baseUrl` + a model id.
- [ ] No API key is ever present in `config.json`, the renderer, or any log.
- [ ] With no key configured, the app still loads and shows a "connect a provider" state (mock behind
      the scenes, not surfaced as a real answer).
- [ ] The BYOP Console panel shows **no** Mini/Pro tier control.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green (tests use the `mock` provider / a fake SDK).

## Test plan

- `test/ai-service.test.ts` — extend: provider selection across the expanded enum; `enabled:false`
  short-circuit; `draftWorkflow` re-validation; mock still default with no key.
- `test/sdk-provider.test.ts` — inject a fake AI-SDK `generateText`/`generateObject` (don't hit the
  network) and a fake `getKey`; assert provider→model mapping, key wiring, and `AiAnswer` mapping.
  Keep electron-free.
- `shared/ai-models.test.ts` — catalog shape + `defaultModelFor`.
- Contract test for `listModels` if added.

## Risks / open questions

- **Streaming.** Stay resolve-once here (`generateText`). P4 swaps in `streamText` + a push channel.
- **Per-provider quirks** (system prompt placement, tool-call formats, JSON-mode support for
  `generateObject`). The AI SDK normalizes most; test `generateObject` per provider since structured
  output support varies (some need a tool-call fallback).
- **Reachability probe cost.** Don't probe on every `aiStatus()` — cache the result for ~30s and
  prefer a cheap/free check (model list endpoint) over a paid 1-token call where the provider offers
  one.
- **Model ids drift.** Catalog is curated + free-text override; don't block new models on a release.
  Use the `claude-api` skill for Claude ids.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-3-universal-providers.md` and `CLAUDE.md`, then implement it.
> Replace the mock/throwing AI providers with a **real universal layer using the Vercel AI SDK**
> (`ai` + `@ai-sdk/anthropic`/`openai`/`google`/`xai`/`openai-compatible`). BYOP: the user picks a
> provider + model and pastes their own key — read it from the **P2 secrets vault**, never
> `config.json` or the renderer. Implement real `ask`/`draftWorkflow`(`generateObject`, re-validated)/
> `summarizeDigest`. Expand `AiProviderIdSchema`, add `model`/`baseUrl`, leave a `managed` enum slot
> for P9, and **remove the Mini/Pro tier control from the BYOP Console panel**. Keep the `mock`
> provider for tests only. Use the `claude-api` skill for Claude model ids — don't hard-code from
> memory. Add tests with a faked SDK (no network); run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
