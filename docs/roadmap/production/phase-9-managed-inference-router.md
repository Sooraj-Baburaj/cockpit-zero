# Production Phase 9 — Managed inference + complexity router

> **Status:** ✅ Done · **Depends on:** P3 (provider abstraction + the `managed` enum slot), P7
> (auth + user/plan) · **Blocks:** nothing. **Risk:** high — our keys, our cost, automatic routing.

For a **logged-in paid** user who depends on _our_ AI (not BYOP), the backend becomes the inference
provider: it holds **our** provider keys behind one endpoint and **automatically picks the model by
task complexity** (cheap model for simple asks, frontier for hard ones). Per the product decision,
**these users never see a Mini/Pro picker** — the router decides. Usage is **metered** now; **billing
is deferred** (a later Stripe phase reads the meter).

## Goal

The desktop `managed` provider sends prompts to our backend `/inference` endpoint; the backend's
**router** classifies complexity, selects a concrete model, calls the provider with our key (streaming
through), and **records usage**. The Console hides the tier control and shows "Auto" for managed users.

## Locked decisions honored

- **Backend proxy (our keys) + our router** — no third-party gateway in the prompt path.
- `Mini`/`Pro` is now an **internal routing detail**, never a BYOP/paid user-facing control. The v1
  `modelTier` enum survives only inside the router's tier mapping.
- Billing deferred — meter only; gate paid access on P7's `plan` flag.

## Scope

**In**

- Backend `/inference` (auth-gated, plan-gated): accepts a chat/ask request, runs the **router**,
  calls the selected provider via the AI SDK with **our** key (from server env/secret manager),
  **streams** the response back, and writes a **usage** record (tokens in/out, model, latency, cost
  estimate) per user.
- The **complexity router**: a fast classifier that maps a request → a tier → a concrete model.
  Start with a transparent **heuristic** (input length, presence of tools/code/long context, explicit
  "think hard" cues) and optionally a tiny **classifier model** call for ambiguous cases; cache by
  prompt-shape. Document the tier→model map (per the `claude-api` skill + other providers).
- A desktop `managed` provider (implements the P3 `AiProvider` port) that calls `/inference` with the
  session token (vault) instead of a local key. Streaming via P4's path.
- Console: when `authStatus().plan === 'pro'` and provider = `managed`, **hide** the model/tier
  controls and show an "Auto — we pick the best model per task" state. BYOP users are unchanged.
- Usage surfacing: a simple "AI usage this period" read for the user (counts/tokens), feeding the
  future billing phase.

**Out**

- Stripe checkout / invoicing / hard quota enforcement (later billing phase). Meter + a soft cap only.
- Fine-tuned or self-hosted models. We route across **provider** models we already use in BYOP.

## Data model & schema changes

- Backend `usage` table: `(id, userId, ts, model, tier, inputTokens, outputTokens, costEstimate,
requestId)`. Per-user aggregates for the usage read.
- `ai.provider` can be `managed` (already added in P3). For managed, `model`/`modelTier` are ignored
  by the client (router decides). Add `ai.routing` notes only if a power-user override is wanted
  (default off — the point is automatic).
- Shared wire types for the inference request/response + usage summary in `packages/shared`.

## IPC channels (desktop)

Reuse `askAI`/`askAIStream` — when `provider === 'managed'` they route to the backend provider. Add:

```ts
aiUsage: 'ai:usage',
// IpcApi
aiUsage(): Promise<{ period: string; requests: number; inputTokens: number; outputTokens: number }>;
```

## Backend work

- `routes/inference.ts` (auth + plan gate): validate the request, run `services/router.ts`, call the
  AI SDK with our key, **stream** the result (Hono streaming/SSE), and on completion write a `usage`
  row. Handle provider errors/fallbacks (retry on a cheaper model, surface a clear error).
- `services/router.ts`: pure-ish complexity scoring → tier → model map; unit-tested. Keep the model
  map in one place; consult the `claude-api` skill for Claude ids and pin sane defaults per provider.
- `routes/usage.ts`: per-user usage aggregate.
- Our provider keys live in **server-side** secrets (env / a secret manager), never in the repo or the
  client.

## Main-process / desktop work

- `infra/ai/managed-provider.ts` — implements the P3 `AiProvider` port by calling `/inference`
  (streaming) with the vault session token. `ready()` = signed in + plan ≥ pro.
- Provider selection in `ai-service.ts` already keys off `config.ai.provider`; `managed` slots in.

## Renderer work

- Console "Cockpit AI" panel: branch on plan. **Managed (pro):** no model/tier picker — an "Auto"
  explainer + the connection/plan state + a usage readout. **BYOP (free):** unchanged from P3.
- Make switching between "Use my own key (BYOP)" and "Use CockpitZero AI (managed)" a clear, single
  choice for signed-in users.

## Acceptance criteria

- [ ] A signed-in pro user with `provider: managed` gets real answers via `/inference` with **no** key
      configured on the client; streaming works (P4 path).
- [ ] The router selects a **cheaper** model for a trivial prompt and a **frontier** model for a
      complex/long/tool-heavy one (unit-tested on the scoring function).
- [ ] Managed users see **no** Mini/Pro/model control — only "Auto"; BYOP users still pick provider+model.
- [ ] Every managed request writes a `usage` row; `aiUsage()` reflects it.
- [ ] Our provider keys are server-side only; never sent to or stored on the client.
- [ ] Plan gating works (free user can't hit `/inference`); billing is **not** required (deferred).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `apps/backend/test/router.test.ts` — the complexity scorer: trivial→cheap tier, complex→frontier,
  boundary cases; deterministic.
- `apps/backend/test/inference.test.ts` — auth+plan gating (401/403), a faked provider call returns a
  stream, a usage row is written. Via `app.request`, no live provider.
- Desktop `managed-provider` test with a fake HTTP/stream client + fake vault.

## Risks / open questions

- **Cost control.** Our keys = our spend. Enforce a soft per-user cap + alerting now even though
  billing is deferred; the router defaulting cheap protects margin.
- **Router quality.** A bad classifier over-spends or under-serves. Keep it transparent + tunable;
  log tier decisions; consider a feedback signal ("this needed a better model"). Reference RouteLLM-
  style approaches but ship the simple heuristic first.
- **Streaming through the backend.** Proxy the provider stream end-to-end (client → our backend →
  provider) without buffering the whole response; use Hono streaming + the AI SDK's stream.
- **Abuse / key safety.** Auth + plan gate + rate limit `/inference`; never expose our keys; rotate.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-9-managed-inference-router.md` and `CLAUDE.md`, then implement
> the **managed** (paid) inference tier: a backend `/inference` endpoint (auth + plan gated) that
> holds **our** provider keys, runs a **complexity router** to pick the model automatically
> (cheap→frontier), calls the provider via the AI SDK, **streams** back, and writes a **usage** record
> (meter now, billing deferred). Add a desktop `managed` provider (P3 port) that calls `/inference`
> with the vault session token — no client-side key. In the Console, **hide the Mini/Pro/model
> controls for managed pro users** (show "Auto") while leaving BYOP unchanged. Keep our keys
> server-side only; gate on P7's `plan` flag. Use the `claude-api` skill for Claude model ids. Unit-
> test the router scorer + gating via `app.request`; run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
