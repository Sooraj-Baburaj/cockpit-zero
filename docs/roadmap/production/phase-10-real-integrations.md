# Production Phase 10 — Real routine sources + agent connectors (integrations)

> **Status:** ✅ Done · **Depends on:** P2 (vault for OAuth tokens), P7 (per-user auth) ·
> **Blocks:** nothing (it completes the "no mocks" mandate). **Risk:** high · **Size:** largest —
> schedule as its own track and split per connector.
>
> **Shipped:** OAuth framework (system browser + loopback, `runOAuthFlow`) + connectors for
> Slack (OAuth + token), Gmail/Calendar (Google OAuth), GitHub (OAuth + PAT), Linear (API key),
> Notion (integration secret) — official SDKs throughout. Real `NotificationSource` adapters
> replace the Phase-5 mocks (`mock-sources.ts` deleted); real `slack.send` /
> `calendar.create-event` agent tools replace the `slides.create` stub (grant + review gated).
> Console → Integrations panel, Routines source picker (connected sources only),
> `integration:connect/disconnect/status` IPC, encrypted per-user `/integrations` backend
> mirror. OAuth app creds come from `COCKPITZERO_{SLACK,GOOGLE,GITHUB}_CLIENT_ID/_CLIENT_SECRET`
> env vars; token-paste works without them.

The v1 routine digest (Phase 5) pulls from **mock** notification sources, and the agent's external
tools (slack/calendar/slides — Phase 7 v1) are **stubs**. This phase replaces them with **real
OAuth-backed connectors**, so the morning digest shows real Slack/Gmail/etc. items and the agent can
actually act in those tools. This is the final removal of mocks.

## Goal

A user connects real accounts (Slack, Gmail, GitHub, Linear, Notion, Calendar — phased), routines pull
**real** notifications into the digest, and the agent's tools (P6) perform **real** actions in granted
services. OAuth tokens live in the P2 vault (local) / encrypted server-side (logged-in).

## Locked decisions honored

- Real connectors, no mocks. Use each service's **official SDK / API** (don't hand-roll OAuth or REST
  clients where a maintained SDK exists).
- Tokens in the **vault** (local) or encrypted per-user server-side (signed-in); never `config.json`.
- The same `NotificationSource` port (v1 Phase 5) + `tools/registry.ts` (v1 Phase 7 / P6) — swap
  implementations behind the ports; the engines don't change.

## Scope (phase it per connector — don't do all at once)

**In**

- An OAuth framework for desktop connectors: per-source connect/disconnect, token storage (vault),
  refresh, and revoke. System-browser + loopback/deep-link callback (reuse P7's pattern).
- Real `NotificationSource` adapters replacing the mocks, in priority order — suggested:
  **Slack → Gmail → GitHub → Linear → Notion → Calendar**. Each maps real items to the existing
  digest `DigestSourceItem` shape; time-boxed + degrade to `[]` on failure (CLAUDE.md infra rule).
- Real agent **tool connectors** for granted services (the P6 external tools): e.g. send a Slack
  message, create a calendar event, create a doc/slide — each grant-gated and behind the **review**
  gate before it commits.
- Connection management UI in the Console (per-source connect status, scopes, disconnect) and per-tool
  grant review.
- For signed-in users: store/refresh tokens server-side so routines can run in the cloud (ties into
  any future scheduled cloud runs); local-only users keep tokens in the vault.

**Out**

- Building our own OAuth provider — we're an OAuth **client** to each service.
- Every conceivable connector. Ship the priority set behind a stable port; the rest follow the same
  recipe.

## Packages / infra

```
# Official SDKs per connector, e.g.:
@slack/web-api
googleapis            # Gmail + Calendar
@octokit/rest         # GitHub
@linear/sdk           # Linear
@notionhq/client      # Notion
# OAuth: openid-client or each SDK's OAuth helper — don't hand-roll token exchange
```

## Data model & schema changes

- No secrets in config. Add per-source **connection metadata** (not tokens) so the UI knows what's
  connected: e.g. `connections: z.array(z.object({ source, accountLabel, scopes, connectedAt }))` in
  config — tokens stay in the vault keyed by `SecretName.oauth(source)`.
- `RoutineSourceIdSchema` / `AgentToolId` already exist; extend as connectors land.
- Shared types for connection status + OAuth scopes.

## IPC channels (desktop)

```ts
connectSource: 'integration:connect',
disconnectSource: 'integration:disconnect',
connectionStatus: 'integration:status',

// IpcApi
connectSource(source: string): Promise<{ ok: boolean }>;     // opens system browser OAuth
disconnectSource(source: string): Promise<{ ok: boolean }>;  // revokes + clears vault token
connectionStatus(): Promise<Array<{ source: string; connected: boolean; account?: string; scopes?: string[] }>>;
```

## Main-process / backend work

- `infra/integrations/<source>.ts` per connector: OAuth (token in vault, refresh on expiry) + the
  read mapping (notifications → `DigestSourceItem`) + the write actions (for agent tools). Time-boxed;
  failures → `[]`/clear error, never a crash.
- Wire each into `search-service`-style aggregation isn't needed; wire into the **digest runner**'s
  source list (v1 Phase 5) and the **tool registry** (P6). The ports already exist — implement them.
- Backend (signed-in): store encrypted refresh tokens per user so cloud routines can run; a
  `/integrations` route to manage them. Reuse P7 auth.

## Renderer work

- Console "Integrations" panel: list sources, connect/disconnect, show account + scopes, last-sync,
  errors. Routines panel (v1) now lets users pick from **connected** real sources. Per-tool grant
  review for agent connectors (with clear "this can send/modify" warnings).

## Acceptance criteria

- [ ] Connecting Slack (then the next sources) via OAuth stores a refreshable token in the **vault**,
      and the digest shows **real** Slack items (no mock data anywhere).
- [ ] The agent (P6) can perform a **real** action in a granted, connected service — only after the
      **review→approve** gate; ungranted/disconnected ⇒ blocked, never a fake success.
- [ ] Each source is time-boxed and degrades to empty on failure without breaking the digest/launcher.
- [ ] Tokens are never in `config.json`; disconnect revokes + clears them.
- [ ] No mock notification source or stub tool remains in a production path.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green (connectors faked behind their ports in tests).

## Test plan

- Per-connector adapter tests with a **fake API client** behind the port: read-mapping to
  `DigestSourceItem`, write-action shaping, error→`[]`, token refresh logic. Electron-free.
- Digest-runner + tool-registry tests updated to use real adapters (faked) instead of mocks.
- Backend `/integrations` route tests via `app.request` with a seeded session.

## Risks / open questions

- **OAuth app review.** Slack/Google/etc. require app registration, scopes, and (for Google) a
  verification/security review for sensitive scopes. Budget lead time; start with minimal read scopes.
- **Token security + refresh.** Encrypt at rest (vault local / encrypted column server-side); handle
  refresh + revocation; least-privilege scopes.
- **Rate limits + cost.** Time-box every call; cache; backoff. The digest must never hang the bar.
- **Scope creep.** This is the largest phase — ship **one connector end-to-end first** (Slack),
  prove the framework, then fan out. Each new source is the same recipe.
- **Agent write safety.** Real side effects (send message, create event) must stay behind the P6
  review gate and explicit grants; default off.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-10-real-integrations.md` and `CLAUDE.md`, then replace the mock
> routine notification sources (v1 Phase 5) and the stub agent tools (P6) with **real OAuth-backed
> connectors** using each service's **official SDK** (Slack first, then Gmail/GitHub/Linear/Notion/
> Calendar). Build a desktop OAuth flow (system browser + loopback, tokens in the **P2 vault**, never
> `config.json`) + `connect/disconnect/status` IPC + a Console Integrations panel. Implement each
> `NotificationSource` (→ `DigestSourceItem`) and agent tool **behind the existing ports** — engines
> unchanged; every source time-boxed and degrading to `[]` on failure; every write action grant-gated
> behind the **review** gate. For signed-in users, store refreshable tokens server-side (P7 auth).
> **Ship Slack end-to-end first**, then fan out. No mock/stub may remain in a production path. Test
> connectors with fake clients behind their ports; run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
