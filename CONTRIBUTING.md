# Contributing to CockpitZero

Thanks for taking a look. This document covers setup, the conventions the repo enforces, and the
recipes for the extension points you're most likely to touch.

For the full architectural picture, read [CLAUDE.md](./CLAUDE.md) — it's written for contributors
(human or AI) and is the most detailed guide in the repo.

## Setup

**Prereqs:** Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`).

```bash
corepack enable
pnpm install
pnpm dev
```

`packages/shared` must be built before the apps typecheck cleanly. `turbo` handles the ordering, but
when iterating on shared code, run `pnpm --filter @cockpitzero/shared dev` to rebuild it on change.

Backend work additionally needs Postgres:

```bash
pnpm --filter @cockpitzero/backend db:up       # Docker, pgvector image
pnpm --filter @cockpitzero/backend db:migrate
```

Backend **tests** need no Docker — they run on PGlite (in-process Postgres) with the pgvector
extension.

## Before you open a PR

All four must be green:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

If you changed the public API of anything under `packages/*`, record a version bump:

```bash
pnpm changeset
```

## Commit conventions

**Conventional Commits**, enforced by commitlint via a Husky `commit-msg` hook:

```
type(scope): subject
```

Allowed scopes: `desktop`, `backend`, `web`, `shared`, `eslint-config`, `tsconfig`, `repo`, `deps`.

Example: `feat(desktop): add web-search action type`

Pre-commit runs `lint-staged` (eslint --fix + prettier on staged files).

## The rules that matter

These aren't style preferences — breaking them breaks the architecture:

1. **Zod schemas in `packages/shared` are the source of truth.** Types are `z.infer`'d. Never
   maintain a hand-written parallel type.
2. **No raw IPC in components.** Only `src/preload/index.ts` may touch `ipcRenderer`. Components call
   `window.api.*`. `apps/desktop/test/ipc-contract.test.ts` fails if the two sides drift.
3. **Secrets never touch `config.json` or the renderer.** API keys, session tokens and OAuth tokens
   go in the OS-keychain-backed vault (main process). The renderer learns only _status_ (set/unset).
4. **OS and network access lives in `infra/` only**, reached through injected ports. This is what
   keeps the test suite `electron`-free and offline.
5. **Context isolation and sandbox stay on.** Don't disable them to make something easier.
6. **No mocks in production code.** Test doubles belong in `*.test.ts` / `test/`. The single
   exception is the `mock` AI provider, kept so CI and first-run work with no key.
7. **Don't reinvent the wheel.** Prefer a maintained package (AI SDK, LanceDB, transformers.js,
   better-auth, official connector SDKs) and hand-roll only the glue.
8. **Apps never import from each other.** Anything cross-cutting lives in `packages/shared`.

## Testing conventions

- **Vitest** everywhere. Co-locate unit tests as `*.test.ts` next to source (shared), or under
  `test/` (apps).
- Backend route tests use `app.request(...)` against the exported `app` — no port binding.
- Keep desktop tests free of `electron` imports so they run in plain Node. Test pure logic in
  `shared`, or contract-level invariants in `apps/desktop/test/`.
- New ports get a fake adapter in the test, not a network call.

## Extension recipes

Each of these is a small, well-trodden path. CLAUDE.md has the long form.

### Add an action type

1. Add a member to `ActionSchema` in `packages/shared/src/schemas.ts` (spread `baseActionShape`).
2. Add a handler in `apps/desktop/src/main/services/action-runner/handlers/` and register it in
   `registry.ts` — the registry's mapped type errors until every kind has a handler.
3. Add a `case` to `actionSubtitle` and an entry to `actionTypeLabel` in `renderer/lib/format.ts`.
4. Branch in `ActionForm` only if the type has bespoke fields.
5. Extend `packages/shared/src/actions.test.ts` and `apps/desktop/test/action-runner.test.ts`.

### Add a search provider

1. Define the OS capability as a port in `services/search/provider.ts`; implement it in an `infra/`
   adapter (platform branching + timeouts live there).
2. Add `services/search/<name>-provider.ts` exporting `create<Name>Provider(adapter)` — take the
   adapter **injected**, map results via `fuzzyRank` + `toRanges`.
3. Wire it into `search-service.searchSystem` (the async phase), never the synchronous
   `resolveLauncherQuery`.
4. If it introduces a new `LauncherItemKind`, extend the union, `format.ts`, `ResultIcon`, the
   `SECTION_RANK`/`SECTION_LABEL` maps, and `LauncherBar.run`.
5. Test with a fake adapter (see `apps/desktop/test/apps-provider.test.ts`).

### Add an agent tool

1. Add the id to `AGENT_TOOL_IDS` in `packages/shared` — the registry's mapped type will error until
   you implement it.
2. Implement it in `services/agent/tools/`, taking ports + `ToolContext`.
3. Register it in `tools/registry.ts` with its `grant` and `sideEffecting` flag.
4. **Do not** check grants inside the tool — the runner enforces them in one place.

### Add an IPC channel

1. Add the name to `IpcChannels` and the signature to `IpcApi` in `packages/shared/src/ipc.ts`.
2. Add `ipcMain.handle(...)` in `apps/desktop/src/main/ipc/index.ts`.
3. Add the method to the `api` object in `apps/desktop/src/preload/index.ts`.
4. Call it via `window.api.x(...)`.

### Add a backend route

1. Create `apps/backend/src/routes/<name>.ts` exporting a `Hono` instance; validate input with
   `zValidator` and reuse shared schemas where the shape is shared.
2. Gate with `requireAuth` if it needs a user.
3. Register it in `apps/backend/src/app.ts`.
4. Test with `app.request('/<name>')`.

## Reporting bugs

Include your OS and version, the CockpitZero version (shown at the bottom of the Console sidebar),
and what you expected versus what happened. **Never paste an API key, session token, or the contents
of your secrets vault into an issue.**

For security vulnerabilities, use [SECURITY.md](./SECURITY.md) instead — not a public issue.
