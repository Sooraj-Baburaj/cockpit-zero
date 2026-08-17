# CockpitZero — Production roadmap

The AI Cockpit was built mocks-first — an offline mock provider, a keyword-only local memory, a
scripted task planner, and stubbed backend `/auth` + `/sync`. These ten phases replaced every one of
those with the real thing. **P1–P10 have all landed**; the docs stay as the design record — what was
decided, why, and what each phase had to satisfy. For what actually ships today, see the
[README](../../README.md).

> **The mandate: no mocks in shipping code.** From here on, every integration is real. Mock/fake
> implementations may exist **only** as test doubles under `*.test.ts` / `test/` (and the one
> `mock` provider we keep purely so CI can run with no key). Production code paths call real
> providers, real vector stores, real OAuth, real persistence.

Each `phase-N-*.md` is **self-contained** — drop it into a fresh chat with `CLAUDE.md` and it ships
without the others' history. Every doc ends with a ready **kickoff prompt** to paste into that chat.

## Locked architecture decisions

These were decided up front; every phase assumes them. Don't relitigate inside a phase chat.

| Concern                       | Decision                                                                                             | Why                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Universal provider (BYOP)** | **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`/`openai`/`google`/`xai` + `@ai-sdk/openai-compatible`) | One `streamText`/`generateObject` API across Claude, OpenAI, Gemini, Grok, and any OpenAI-compatible endpoint (OpenRouter, Ollama, custom). TS-native; tool-calling + structured output built in.                                                                                   |
| **Memory engine**             | **Native TS pipeline + LanceDB + local embeddings**                                                  | Our own extract→embed→dedup→hybrid-recall pipeline. Embedded LanceDB vector store locally; `transformers.js` (ONNX) embeddings run on-device with **no key/offline**. Backend swaps LanceDB→pgvector. Full local-first control, no Python runtime.                                  |
| **Paid inference**            | **Backend proxy (our keys) + our complexity router**                                                 | The backend holds our provider keys behind one endpoint; a complexity classifier picks the model (cheap→frontier) per request. We own cost, routing, and usage metering.                                                                                                            |
| **Auth / billing**            | **Real auth + cloud sync now; billing deferred**                                                     | Stand up real accounts + cloud sync first so logged-in memory/sync works. Stripe metered billing comes later; paid features gate on a flag until then. Auth impl = **better-auth** (Drizzle-backed, fits our existing backend) — managed (Clerk/WorkOS) is the documented fallback. |

### Two product tiers

- **Free / BYOP / local-first / no login.** The user pastes their own provider key (Claude, OpenAI,
  Gemini, Grok, …). Everything — memory, history, knowledge — lives **on-device**. No account
  required, ever. This is the default experience.
- **Logged-in (paid) / managed.** The user depends on _our_ AI. We route across models automatically
  by task complexity — **the `Mini`/`Pro` tier picker is hidden for these users** (the router
  decides). Memory/knowledge sync to the backend for cross-device + better recall. Billing is metered
  (deferred phase).

## Phases

| #   | Phase                                                                  | Net-new surface                    | Depends on  |
| --- | ---------------------------------------------------------------------- | ---------------------------------- | ----------- |
| 1   | [Rename Settings → Console](phase-1-rename-console.md)                 | terminology + file/symbol rename   | —           |
| 2   | [Secrets vault (safeStorage)](phase-2-secrets-vault.md)                | OS-keychain secret store + IPC     | —           |
| 3   | [Universal provider layer (BYOP)](phase-3-universal-providers.md)      | real multi-provider AI via AI SDK  | 2           |
| 4   | [Streaming end-to-end](phase-4-streaming.md)                           | token streaming for ask + task     | 3           |
| 5   | [Local memory engine](phase-5-local-memory-engine.md)                  | LanceDB + embeddings + extraction  | 3           |
| 6   | [Real agent loop + tools](phase-6-real-agent-loop.md)                  | AI-SDK tool-use agent, review gate | 3, 5        |
| 7   | [Backend auth + cloud sync](phase-7-backend-auth-sync.md)              | better-auth, real `/sync`, login   | — (backend) |
| 8   | [Cloud memory + knowledge](phase-8-cloud-memory-knowledge.md)          | pgvector memory + doc ingestion    | 5, 7        |
| 9   | [Paid managed inference + router](phase-9-managed-inference-router.md) | backend model router + metering    | 3, 7        |
| 10  | [Real routine sources (integrations)](phase-10-real-integrations.md)   | OAuth Slack/Gmail/… connectors     | 2, 7        |

## Dependency graph

```
P1 Console rename ── independent (do first; pure terminology)
P2 Secrets vault ── independent foundation
        │
        ▼
P3 Universal providers (BYOP) ──────────────┐
        │                │                  │
        ▼                ▼                  │
P4 Streaming        P5 Local memory         │
                         │                  │
                         ▼                  │
                    P6 Real agent loop      │
                                            │
P7 Backend auth + sync ─────────┬───────────┘
        │                       │
        ▼                       ▼
P8 Cloud memory/knowledge   P9 Managed inference + router
   (needs P5 + P7)             (needs P3 + P7)

P10 Real integrations ── needs P2 + P7 (largest; parallel/last; also supplies P6's external tools)
```

### Suggested order

1. **P1** (rename — quick, unblocks nothing but everything reads cleaner after).
2. **P2 → P3 → P4** (the BYOP core: secrets, real providers, streaming). After P3 the free tier is
   genuinely usable with a user's own key.
3. **P5 → P6** (best-in-world local memory, then the real agent that uses it).
4. **P7** (backend auth + sync) — can run in parallel with the desktop track from the start.
5. **P8** and **P9** (cloud memory; paid router) once P7 lands.
6. **P10** (integrations) — biggest; schedule as its own track. It also upgrades P6's external tools
   (slack/calendar/slides) from local stubs to real connectors.

## Conventions every production phase inherits

From [`CLAUDE.md`](../../CLAUDE.md) and the v1 roadmap, restated so a phase chat can't miss them:

- **No mocks in production code.** Real provider, real store, real OAuth. Test doubles live only in
  tests. The single exception is the kept `mock` AI provider (gated to dev/CI, never a default for a
  real user).
- **Don't reinvent the wheel.** Prefer a maintained package over hand-rolling (AI SDK, LanceDB,
  transformers.js, better-auth, official provider SDKs). Hand-roll only the thin glue between them.
- **Schemas are the source of truth.** New config shape → Zod in `packages/shared/src/schemas.ts`;
  types are `z.infer`'d. Never hand-write a parallel type.
- **No raw IPC in components.** Four-step recipe (shared `ipc.ts` → main `ipc/index.ts` → preload →
  component). `apps/desktop/test/ipc-contract.test.ts` enforces parity.
- **Secrets never touch `config.json` or the renderer.** API keys / OAuth tokens live in the
  **secrets vault** (P2, Electron `safeStorage`). The renderer only ever learns _status_ (set/unset),
  never plaintext.
- **OS / network access lives in `infra/` only**, reached through injected ports — services stay
  unit-testable and `electron`-free in tests.
- **Native modules (LanceDB, transformers.js, optionally better-sqlite3) run in the main process
  only**, must be `external`-ized in `electron.vite.config.ts`, and need an Electron ABI rebuild
  (`@electron/rebuild` / electron-builder's install step). Never import them in the renderer.
- **Local-first & privacy-aware.** Anything leaving the machine is explicit, minimal, behind a
  toggle, and only happens for a logged-in user who opted in.
- **Sahara visual language** + **keyboard-first** for every new surface (warm tokens, EB Garamond /
  Manrope, one sienna accent moment, OS-correct key glyphs via `Kbd`).
- Finish each phase with `pnpm typecheck`, `pnpm lint`, `pnpm test` green, and a changeset for any
  `packages/*` API change.

## How to run one phase in a fresh chat

Paste the **Kickoff prompt** block at the bottom of the phase doc. It already names the doc,
`CLAUDE.md`, the decisions to honor, and the "no mocks / production" bar.
