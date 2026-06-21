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
pnpm --filter @cockpitzero/desktop dev    # Electron launcher (hotkey: Cmd/Ctrl+Shift+Space)
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

A workflow (`WorkflowSchema`) is a name + an ordered list of action ids. It's edited in Settings →
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
- **electron-vite multi-entry.** The renderer has two HTML entries (`launcher.html`,
  `settings.html`); add new windows by adding an entry in `electron.vite.config.ts`.
- **The preload bridge is dev-gated.** `renderer/lib/api.ts` falls back to a mock `window.api` only
  when `import.meta.env.DEV` (browser/dev). In production a missing bridge **throws** — don't
  "fix" a preload error by widening the fallback; that would hide the real failure behind a silent
  no-op launcher.
- **System search shells out.** `infra/file-search.ts` runs `mdfind` / PowerShell; keep new OS calls
  there, always time-boxed and wrapped so failures return `[]`. Linux is unimplemented (returns
  empty) for both apps and files.
- **macOS app icons ≠ `app.getFileIcon`.** Electron's `app.getFileIcon` returns a *generic
  placeholder* for `.app` bundles (byte-identical across apps), so icons for app rows are read from
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
- **Translucency is one token.** Both the launcher panel (`.cz-panel`) and the settings window
  (`.cz-window`) share `--cz-panel-bg`'s alpha (per theme); the "Frosted glass" toggle swaps both to
  opaque via `.cz-no-glass`. Tune transparency on that token, not on components.
- **Settings nav order** is the `TABS` array in `screens/Settings.tsx` (actions → workflows →
  aliases → general → appearance); the initial tab must be a member of it.

## Code intelligence (codegraph)

The repo is indexed by **codegraph** (a local SQLite symbol graph in `.codegraph/`, git-ignored).
Query it before editing to trace call paths / blast radius (MCP tools, or the `codegraph` CLI:
`query`, `callers`, `callees`, `impact`). It lags writes by ~1s via a file watcher; after large
changes run `codegraph sync`. If absent, run `codegraph init .`. It's an authoring aid only —
nothing at runtime depends on it.

## Non-goals / follow-ups

- electron-builder packaging (`electron-builder.yml`) is scaffolded but not a focus; add signing
  - icons before shipping installers.
- Backend `/sync` and `/auth` are stubs (shape-validated, no real persistence/auth yet).
- SQLite is the dev default; Postgres is supported structurally (swap the driver in
  `apps/backend/src/db/index.ts` + `drizzle.config.ts`).
