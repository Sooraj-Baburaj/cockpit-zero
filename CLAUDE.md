# CLAUDE.md — CockpitZero

Guidance for working in this repository. Read this before making changes.

## What CockpitZero is

CockpitZero is a **keyboard-first, cross-platform desktop launcher** (think Spotlight /
Raycast). The user summons a frameless command bar with a global hotkey, types to fuzzy-search
their configured **actions** (open a URL, open an app, run a command, paste a snippet), and runs
one with Enter. When the query doesn't match a configured item, the launcher also searches
installed **applications and files** (Spotlight on macOS, the Search index on Windows). Actions can
be chained into **workflows**. Actions, aliases, and workflows are stored locally; an optional
backend syncs config across devices.

## Product tiers & AI architecture (production direction)

The AI Cockpit shipped first as **mocks** (see `docs/roadmap/phase-1..7`). It is now being taken to
**production**, planned phase-by-phase under [`docs/roadmap/production/`](./docs/roadmap/production/)
(read its `README.md` for the locked decisions + dependency graph before building any AI/memory/
backend feature). Two tiers:

- **Free / BYOP / local-first / no login.** The user pastes their **own** provider key and everything
  (memory, history, knowledge) stays on-device. No account is ever required — this is the default.
- **Logged-in (paid) / managed.** The user depends on _our_ AI; the backend routes across models
  **automatically by task complexity**, so these users see **no Mini/Pro tier picker**. Memory/
  knowledge sync to the backend. (Billing is deferred; auth + sync come first.)

Locked technical decisions (don't relitigate inside a feature chat):

- **Universal provider = Vercel AI SDK** (`ai` + `@ai-sdk/{anthropic,openai,google,xai}` +
  `@ai-sdk/openai-compatible`). One `streamText`/`generateObject` API across Claude, OpenAI, Gemini,
  Grok, and any OpenAI-compatible endpoint (OpenRouter/Ollama/custom). Runs in the **main process**
  only (keys never reach the renderer). Use the `claude-api` skill for Claude model ids.
- **Memory engine = native TS pipeline + LanceDB + local embeddings.** Extract durable facts
  (`generateObject`) → embed (on-device `@huggingface/transformers` ONNX, no key/offline; provider
  embeddings when a key exists) → store in **LanceDB** under `userData` → **hybrid recall**
  (semantic + keyword + recency) with dedup/update/decay. Logged-in: the same ports back onto
  **Postgres + pgvector**. Not the keyword JSON store of v1.
- **Managed inference = our backend proxy + our complexity router.** The backend holds our keys,
  picks the model per request, streams back, and meters usage. No third-party gateway in the prompt
  path.
- **Auth = better-auth** (Drizzle, fits the existing backend); managed (Clerk/WorkOS) is the fallback.

**Naming: it's the "Console", not "Settings".** The configuration window/screen/navigation is the
**Console** (the rename is production phase 1). The `config.settings` **domain object**
(`SettingsSchema`, appearance/general) keeps its name — only the window/nav concept is "Console".

**No mocks in production code.** Real provider, real vector store, real OAuth, real persistence.
Mock/fake implementations live **only** in tests (`*.test.ts` / `test/`). The one survivor is the
`mock` AI provider, kept solely so CI runs with no key — never a default once a real provider/key is
configured. **Don't reinvent the wheel** — prefer a maintained package (AI SDK, LanceDB,
transformers.js, better-auth, official connector SDKs) over hand-rolling; hand-roll only the glue.

## Monorepo structure

Turborepo + pnpm workspaces. pnpm **catalogs** (in `pnpm-workspace.yaml`) centralize shared
dependency versions — reference them as `"dep": "catalog:"`.

The desktop main process is layered (app / services / infra / windows / ipc) and the renderer
follows atomic design (atoms → molecules → organisms → templates → screens + hooks/lib). Launcher
search/ranking uses the `fzf` library via `packages/shared/src/search.ts` for configured
actions/workflows; installed-app and file results come from search providers in the main process
(`src/main/services/search`). Every launcher row is a `LauncherItem` (a discriminated union — see
below). See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full layer breakdown and data
flow.

```
apps/
  desktop/   Electron app (electron-vite, React, Tailwind v4) — the launcher
  backend/   Hono API on Node (Drizzle + SQLite, Postgres-swappable) — sync/auth/telemetry
  web/       Next.js 15 marketing + download site
packages/
  shared/         Pure TS: Zod schemas (source of truth), inferred types, IPC contract, utils
  eslint-config/  Shared ESLint 9 flat configs (base / react / next / node)
  tsconfig/       Shared TS base configs (base, node, electron-main, electron-renderer, nextjs)
```

### Dependency graph

```
@cockpitzero/shared        →  desktop, backend, web   (types, schemas, IPC contract, utils)
@cockpitzero/tsconfig      →  every package (extends)
@cockpitzero/eslint-config →  every package (lint)
```

Apps **never** import from each other. Anything cross-cutting lives in `packages/shared`.

## Running locally

Prereqs: Node 22 (`.nvmrc`), pnpm 10 (`corepack enable`).

```bash
pnpm install          # install everything
pnpm dev              # run the whole stack via Turborepo
pnpm build            # build all (shared builds first, then apps)
pnpm lint             # eslint across all packages
pnpm typecheck        # tsc --noEmit across all packages
pnpm test             # vitest in desktop + backend + shared
pnpm format           # prettier --write
```

### Individual apps

```bash
pnpm --filter @cockpitzero/desktop dev    # Electron launcher (hotkey: Cmd/Ctrl+J)
pnpm --filter @cockpitzero/backend dev    # Hono server on :8787
pnpm --filter @cockpitzero/web dev        # Next.js on :3000
```

`packages/shared` must be built before apps typecheck cleanly (`turbo` handles ordering via
`dependsOn: ["^build"]`). When iterating, run `pnpm --filter @cockpitzero/shared dev` to rebuild
it on change.

## IPC architecture (desktop)

The renderer is sandboxed and **context-isolated**. It never touches `ipcRenderer` directly.
All main↔renderer communication flows through a single typed bridge:

```
renderer component
  → window.api.<method>()            (typed by IpcApi, from shared)
    → src/preload/index.ts           (the ONLY place ipcRenderer is used; contextBridge)
      → ipcRenderer.invoke(channel)  (channel name from IpcChannels, from shared)
        → src/main/ipc/index.ts      (ipcMain.handle for that channel)
          → store / actions / windows
```

The contract lives in `packages/shared/src/ipc.ts`: `IpcChannels` (channel-name constants) and
`IpcApi` (the typed `window.api` surface). Both main and preload import it, so the two sides can
never disagree. `apps/desktop/src/preload/index.d.ts` augments `Window` with `api: IpcApi`, so
components get full typing and autocomplete.

### Adding a new IPC channel

1. Add the channel name to `IpcChannels` and its signature to `IpcApi` in
   `packages/shared/src/ipc.ts`.
2. Add an `ipcMain.handle(IpcChannels.x, …)` in `apps/desktop/src/main/ipc/index.ts`.
3. Add the matching method to the `api` object in `apps/desktop/src/preload/index.ts`.
4. Call it from a component via `window.api.x(...)`.

`apps/desktop/test/ipc-contract.test.ts` fails if the two sides drift apart.

## Where config is stored on disk

electron-store writes a `config.json` to the OS app-data directory:

| OS      | Path                                                    |
| ------- | ------------------------------------------------------- |
| macOS   | `~/Library/Application Support/CockpitZero/config.json` |
| Windows | `%APPDATA%\CockpitZero\config.json`                     |
| Linux   | `~/.config/CockpitZero/config.json`                     |

Every read/write goes through `ConfigSchema` (`apps/desktop/src/main/infra/store.ts`); a corrupt
file falls back to `defaultConfig()`.

## How to add a new action type

Actions are a discriminated union on `type`. To add one (e.g. `search-web`):

1. **Schema** — add a member to `ActionSchema` in `packages/shared/src/schemas.ts` (spread
   `baseActionShape` so it inherits `id`/`title`/`argument`). The type is inferred automatically
   (`Action` in `types.ts`); never hand-write it.
2. **Execution** — drop a handler file in
   `apps/desktop/src/main/services/action-runner/handlers/` and register it in `registry.ts`. The
   registry's mapped type (`{ [K in ActionKind]: ActionHandler<K> }`) makes TS error until every
   kind has a handler. Handlers receive `(action, ports)` — reach the OS only through `ports`
   (`ActionPorts`), never `electron` directly, so they stay unit-testable.
3. **Subtitle/preview** — add a `case` to `actionSubtitle` and an entry to `actionTypeLabel` (the
   badge) in `apps/desktop/src/renderer/lib/format.ts` (and `templatedStrings` in
   `packages/shared/src/actions.ts` if the new type has templatable fields).
4. **UI** — the launcher and `ActionForm` render generically; add a branch to `ActionForm`
   (`src/renderer/components/organisms/`) only if the new type has bespoke fields.
5. Add/extend tests in `packages/shared/src/actions.test.ts` (or `search.test.ts`) and
   `apps/desktop/test/action-runner.test.ts`.

### Parameterized actions (Level 2)

Any action can declare optional `arguments` (an ordered array of
`{ name, placeholder, required }`) and use `{name}` tokens in its templated fields (url / target /
command / args / content). `effectiveArguments(action)` returns the declared parameters, or — when
none are declared — synthesizes one per `{token}` found, so "tokens imply parameters" still works.
At runtime the launcher captures the text after a matching alias keyword and splits it positionally
into one value per parameter (`splitArgumentValues`; the **last** parameter is greedy); the IPC
layer calls `applyArguments(action, values)` (`packages/shared/src/actions.ts`) to substitute each
token (URL-encoding for `open-url`) before the action runner executes it. `resolveQuery` decides
between normal results and the argument-capture state. All of this is pure and lives in `shared`.

### Workflows (Level 3)

A workflow (`WorkflowSchema`) is a name + an ordered list of action ids. It's edited in Console →
Workflows (`WorkflowEditor` / `WorkflowForm`), shows up in the launcher as a `workflow` result, and
runs via the `runWorkflow` IPC channel → `services/workflow-runner.ts`, which resolves each step id
to an action and runs them in sequence through the existing action-runner. Execution is intentionally
**basic** (sequential, no per-step arguments or conditionals).

## How launcher results are produced

Every row the launcher renders is a `LauncherItem` (`packages/shared/src/types.ts`) — a discriminated
union on `kind`: `action` / `workflow` (from config) and `app` / `file` (from system search). Run a
row by switching on `kind` (`LauncherBar.run`): `runAction(id)`, `runWorkflow(id)`, or
`openPath(path)`.

Resolution has two halves, delivered over **two separate IPC calls** so the slow OS index never
delays the configured matches (the renderer fires both in parallel and merges — see
`hooks/useLauncherSearch.ts`):

- **Config (instant).** `resolveQuery(input, config)` (`shared`) decides argument-capture vs ranked
  results; `searchConfig` ranks actions + workflows. `fuzzyRank<T>` is the generic `fzf` ranker —
  reuse it for any new source, never hand-roll matching. The main-process `resolveLauncherQuery`
  (channel `resolveQuery`) wraps this **synchronously** — it does NOT await system search.
- **System search (async, desktop main).** For a non-empty plain query the renderer also calls the
  `searchSystem` channel → `search-service.searchSystem`, which fans out to the app + file providers
  in parallel and `aggregate.mergeResults` dedupes + section-orders (Applications → Files) + caps.
  The renderer appends these to the config rows (final order Actions → Workflows → Applications →
  Files, capped at `RESULT_LIMIT`). OS access lives **only** in `infra/app-scanner.ts` (installed
  apps) and `infra/file-search.ts` (files: macOS `mdfind`, Windows `SystemIndex`), each time-boxed
  and degrading to `[]` so a slow index never blocks the bar.

### How to add a search provider

1. Define any new OS capability as a port type in `services/search/provider.ts` and implement it in
   an `infra/` adapter (platform-branch + timeouts there; keep it the only OS-touching code).
2. Add `services/search/<name>-provider.ts` exporting a `create<Name>Provider(adapter)` that returns
   a `SearchProvider` — take the adapter **injected** (dependency inversion) and map results to
   `LauncherItem`s via `fuzzyRank` + `toRanges`. This is what keeps provider tests electron-free.
3. Wire it into `search-service.searchSystem` (the async phase — parallel `Promise.allSettled` +
   `mergeResults`), not the synchronous `resolveLauncherQuery`. If it introduces a new
   `LauncherItemKind`, extend the union, `format.ts` (`itemSubtitle`/`itemBadge`), `ResultIcon`, the
   `SECTION_RANK`/`SECTION_LABEL` maps, and `LauncherBar.run`.
4. If the row runs differently, add an IPC channel (recipe above); else reuse `openPath`.
5. Test the provider with a fake adapter under `apps/desktop/test/` (see `apps-provider.test.ts`).

## How to add a backend route

1. Create `apps/backend/src/routes/<name>.ts` exporting a `Hono` instance. Validate input with
   `zValidator('json' | 'query', Schema)` — reuse shared schemas where the shape is shared config.
2. Gate it with `requireAuth` (`src/middleware/auth.ts`) if it needs a user.
3. Register it in `apps/backend/src/app.ts` with `.route('/<name>', <name>)`.
4. Add a test in `apps/backend/test/` using `app.request('/<name>')` — no live server needed.

## How to add a web page

App Router: create `apps/web/src/app/<segment>/page.tsx` (server component by default). Put any
browser-only logic in a `'use client'` component under `apps/web/src/components/`. Reuse
`@cockpitzero/shared` for shared constants/types.

### Design context (apps/web)

The marketing site's strategic + visual specs live in `apps/web/PRODUCT.md` (register: brand;
audience, voice, anti-references) and `apps/web/DESIGN.md` (tokens, "The Convergence Point" system:
Ion cyan→blue gradient accent — the orange accent is retired on the web surface). Read both before
web design work; keep them updated when the system evolves.

## Code style rules

- **No raw IPC in components.** Only `src/preload/index.ts` may use `ipcRenderer`. Components
  call `window.api.*`.
- **All shared types live in `packages/shared`.** Don't duplicate domain types in an app.
- **Zod schemas are the source of truth** for config shape. Types are inferred via `z.infer` —
  never maintain a parallel hand-written type.
- Prefer `import type { … }` for type-only imports (enforced by ESLint).
- Format with Prettier (`.prettierrc`); lint with the shared ESLint config.
- **No native `<select>`.** Use the custom `Dropdown` molecule
  (`renderer/components/molecules/Dropdown.tsx`) for every single-choice picker — it's a themed,
  keyboard-navigable ARIA listbox so the popup matches the warm surfaces (the OS-drawn `<select>`
  menu can't be themed). Pass `options: {value,label}[]` + `onChange(value)`, and an `ariaLabel`
  when it isn't already inside a `<Field>`.

## Testing conventions

- **Vitest** everywhere. Co-locate unit tests as `*.test.ts` next to source (shared) or under
  `test/` (apps).
- Backend route tests use `app.request(...)` against the exported `app` (no port binding).
- Keep desktop tests free of `electron` imports so they run in plain Node (test pure logic in
  `shared` or contract-level invariants).

## Commit & PR conventions

- **Conventional Commits**, enforced by commitlint (`commitlint.config.js`) via the Husky
  `commit-msg` hook. Format: `type(scope): subject`, e.g. `feat(desktop): add web-search action`.
  Allowed scopes: `desktop`, `backend`, `web`, `shared`, `eslint-config`, `tsconfig`, `repo`,
  `deps`.
- Pre-commit runs `lint-staged` (eslint --fix + prettier on staged files).
- Use **changesets** for versioning publishable packages: `pnpm changeset` to record a bump.
  Apps are ignored in `.changeset/config.json`; only `packages/*` are versioned.

## Common gotchas

- **Context isolation / sandbox** are ON. The renderer has no Node APIs — everything goes through
  the preload bridge. Don't disable them.
- **Preload limits.** Only structured-cloneable data crosses the bridge; you can't pass functions
  or class instances. Keep `window.api` methods promise-returning and serializable.
- **electron-store v8** is used (CommonJS) so the externalized main process can `require` it.
  Upgrading to the ESM-only v10 means switching the main process to ESM output — don't do it
  casually.
- **pnpm workspace resolution.** Internal deps use `workspace:*`; shared versions use `catalog:`.
  After changing a package's public API, rebuild `shared` (or run `pnpm dev` which watches it).
- **Tailwind v4** has no `tailwind.config.js`. The desktop/renderer uses the `@tailwindcss/vite`
  plugin; the web app uses `@tailwindcss/postcss`. Styles start with `@import "tailwindcss";`.
- **electron-vite multi-entry.** The renderer has multiple HTML entries (`launcher.html`,
  `console.html`, `digest.html`, `task.html`, `ai.html`); add new windows by adding an entry in
  `electron.vite.config.ts`.
- **Chat transcripts are content, not config.** The AI window's sessions persist to
  `userData/chats.json` (`infra/chat-store.ts`, validated by `ChatStoreSchema`) — never
  `config.json`, which syncs. Multi-turn context rides the single-prompt `askStream` path via
  `chatPrompt` (shared), so every provider gets history without a per-provider messages API.
- **Agent tools have launcher parity.** `actions.list` / `actions.run` / `workflows.run` /
  `apps.search` / `apps.open` let the agent do what the user can from the bar, gated by the
  `actions` / `apps` grants. They execute through `services/launcher-exec.ts` — the SAME path as
  the IPC handlers — so never fork a second run-action/run-workflow code path.
- **Secrets never touch `config.json` or the renderer.** API keys (BYOP), the backend session token,
  and OAuth tokens live in the OS-keychain-backed **secrets vault** (Electron `safeStorage`, main
  process). The renderer learns only _status_ (set/unset) over IPC — there is no plaintext read path.
  Don't store a key in `config.json` (it syncs!) or pass one across the preload bridge.
- **Native AI modules are main-process only.** LanceDB (`@lancedb/lancedb`) and transformers.js
  (`@huggingface/transformers`), plus the AI SDK provider calls, run in the **main process** — never
  the renderer. Mark the native ones `external` in `electron.vite.config.ts` and rebuild for the
  Electron ABI when packaging. transformers.js model weights cache under `userData/models`.
- **The preload bridge is dev-gated.** `renderer/lib/api.ts` falls back to a mock `window.api` only
  when `import.meta.env.DEV` (browser/dev). In production a missing bridge **throws** — don't
  "fix" a preload error by widening the fallback; that would hide the real failure behind a silent
  no-op launcher.
- **System search shells out.** `infra/file-search.ts` runs `mdfind` / PowerShell / `plocate`; keep
  new OS calls there, always time-boxed and wrapped so failures return `[]`. Linux apps come from
  the XDG `.desktop` scan in `infra/app-scanner.ts` (launched via `gio launch`/`gtk-launch` in
  `electron-ports.ts` — `shell.openPath` would open the file as text); Linux files need `plocate`
  installed, else file results are skipped.
- **macOS app icons ≠ `app.getFileIcon`.** Electron's `app.getFileIcon` returns a _generic
  placeholder_ for `.app` bundles (byte-identical across apps), so icons for app rows are read from
  the bundle's real `.icns` via `infra/mac-app-icon.ts` (`defaults` + `sips`, time-boxed) — which
  **persists** the converted PNG under `userData/icon-cache` (keyed by path, invalidated by bundle
  mtime) so `sips` runs once per app, not per restart. Files and other platforms (Windows `.lnk`
  shortcuts) still use `app.getFileIcon`, which resolves their real icon. `services/icon-service.ts`
  picks the path per target and keeps an in-memory cache on top. Don't "simplify" app icons back to
  `getFileIcon` — they'll go blank on macOS.
- **Keyboard-focus ring.** A global `:focus-visible` outline lives in `styles.css`. The launcher's
  always-auto-focused search input is excluded via `input:not(.cz-search-input):focus-visible`
  (browsers treat text inputs as perpetually focus-visible) — it has its own focus treatment, so
  don't drop the `cz-search-input` class or the ring will sit on the bar permanently.
- **Translucency is launcher-only ("Facet — solid glass").** Only the launcher panel (`.cz-panel`)
  is translucent, via `--cz-panel-bg` + blur; the Appearance → "Launcher translucency" toggle swaps
  it to the opaque facet surface via `.cz-no-glass`. Every other window (`.cz-window`: Console /
  Task / Digest) is **always opaque** — the "glass" there is lighting (sheen + rim shadow), never
  blur. Tune transparency on `--cz-panel-bg`, not on components.
- **Theme + colour modes are attributes/classes on `<html>`.** Colour tokens are authored once with
  `light-dark()` and switched by `color-scheme`: `useAppearance` sets `data-theme="light|dark"`
  (removed for `system`), plus `cz-mono` (Monochrome UI — the default; remaps the accent family to
  neutral) and `cz-sideacc` (restores the orange accent inside `.cz-console-nav`). Don't reintroduce
  `.theme-dark` classes or per-theme token blocks.
- **Console nav** is `CONSOLE_NAV_GROUPS` in `screens/console-tabs.ts` (Commands: actions →
  workflows → routines → aliases · Intelligence: ai → memory · Connections: integrations ·
  Preferences: general → appearance → config → account); `CONSOLE_TABS` is derived from it and the
  initial tab (`INITIAL_CONSOLE_TAB`) must be a member.

## Code intelligence (codegraph)

The repo is indexed by **codegraph** (a local SQLite symbol graph in `.codegraph/`, git-ignored).
Use it as the **default first step** for understanding and impact-checking — it's faster and more
reliable than fanning out `Read`/`grep`. Two concrete triggers (don't skip these):

1. **Before editing an unfamiliar area** — one `codegraph_explore` call (natural-language question
   or a bag of symbol/file names) returns the verbatim source of the relevant symbols grouped by
   file. Reach for it instead of a chain of `Read`s to map a flow (e.g. the launcher
   resolve→render path).
2. **Before changing any exported/shared function, hook, type, or IPC signature** (anything in
   `packages/shared`, the IPC contract, or a hook/util used across the renderer) — run
   `codegraph_callers` / `codegraph_impact` to scope the blast radius first. This is the highest-
   value case: a signature change to shared code can ripple across apps that a grep misses (e.g.
   through re-exports).

Caveat: codegraph tracks **function/symbol** call edges, not **JSX component-render** usage — so
`impact`/`callers` on a React component (e.g. `SearchField`) will under-report its renderers; fall
back to a grep on the component name there. MCP tools (`codegraph_explore` / `_search` / `_callers`
/ `_callees` / `_impact` / `_status`), or the `codegraph` CLI (`query`, `callers`, `callees`,
`impact`). It lags writes by ~1s via a file watcher; after large changes run `codegraph sync`. If
absent, run `codegraph init .`. It's an authoring aid only — nothing at runtime depends on it.

## Non-goals / follow-ups

- **Production roadmap.** The path from mocks → production is planned in
  [`docs/roadmap/production/`](./docs/roadmap/production/) — Console rename, secrets vault, universal
  BYOP providers, streaming, the local memory engine, the real agent loop, backend auth + sync, cloud
  memory/knowledge, managed inference + router, and real integrations. Each doc is self-contained with
  a copy-paste kickoff prompt.
- electron-builder packaging (`electron-builder.yml`) is scaffolded but not a focus; add signing
  - icons before shipping installers.
- Backend auth + sync are **real** (production phase 7): better-auth (email/password + optional
  Google/GitHub) mounted at `/auth/*`, `requireAuth` validates real sessions (cookie or bearer),
  `/sync` persists per-user `Config` (LWW upsert). Desktop OAuth = system browser →
  `/desktop-auth/*` one-time-code handoff → loopback; the session token lives in the P2 vault.
- The backend is **Postgres-only** (P7 went straight to Postgres per SHIPPING.md):
  `pnpm --filter @cockpitzero/backend db:up` starts the dev instance (Docker, pgvector image),
  `db:migrate` applies migrations. Backend tests need no Docker — they run on **PGlite**
  (in-process Postgres, `DATABASE_URL=pglite://memory` + the `@electric-sql/pglite-pgvector`
  extension, so the P8 vector/hnsw schema works in tests; see `apps/backend/vitest.config.ts`).
- Cloud memory + knowledge are **real** (production phase 8): opt-in (`ai.memorySync`) + signed-in
  only. Backend `memories`/`documents`/`knowledge` tables (pgvector) behind `/memory/*` +
  `/knowledge/*`; the recall **fusion math is shared** (`packages/shared/src/memory-fusion.ts`) —
  never fork it per store. The server **re-embeds** all synced/ingested text (`src/embedder.ts`,
  `OPENAI_API_KEY` or a keyless hash fallback); devices never upload vectors, and the desktop
  re-embeds pulls locally (`memory-sync-service`). Recall fuses local ∪ cloud ∪ knowledge via the
  `withCloudRecall` decorator and degrades to local-only offline/signed-out.
