# CLAUDE.md — CockpitZero

Guidance for working in this repository. Read this before making changes.

## What CockpitZero is

CockpitZero is a **keyboard-first, cross-platform desktop launcher** (think Spotlight /
Raycast). The user summons a frameless command bar with a global hotkey, types to fuzzy-search
their configured **actions** (open a URL, open an app, run a command, paste a snippet), and runs
one with Enter. Actions, aliases, and workflows are stored locally; an optional backend syncs
config across devices.

## Monorepo structure

Turborepo + pnpm workspaces. pnpm **catalogs** (in `pnpm-workspace.yaml`) centralize shared
dependency versions — reference them as `"dep": "catalog:"`.

The desktop main process is layered (app / services / infra / windows / ipc) and the renderer
follows atomic design (atoms → molecules → organisms → templates → screens + hooks/lib). Launcher
search/ranking uses the `fzf` library via `packages/shared/src/search.ts`. See
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full layer breakdown and data flow.

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

| OS      | Path                                                  |
| ------- | ----------------------------------------------------- |
| macOS   | `~/Library/Application Support/CockpitZero/config.json` |
| Windows | `%APPDATA%\CockpitZero\config.json`                   |
| Linux   | `~/.config/CockpitZero/config.json`                   |

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
3. **Subtitle/preview** — add a `case` to `actionSubtitle` in
   `apps/desktop/src/renderer/lib/format.ts` (and `templatedStrings` in
   `packages/shared/src/actions.ts` if the new type has templatable fields).
4. **UI** — the launcher and `ActionForm` render generically; add a branch to `ActionForm`
   (`src/renderer/components/organisms/`) only if the new type has bespoke fields.
5. Add/extend tests in `packages/shared/src/actions.test.ts` (or `search.test.ts`) and
   `apps/desktop/test/action-runner.test.ts`.

### Parameterized actions (Level 2)

Any action can declare an optional `argument` (`{ name, placeholder, required }`) and use `{name}`
tokens in its templated fields (url / target / command / args / content). At runtime the launcher
captures the text after a matching alias keyword as the argument; the IPC layer calls
`applyArgument(action, value)` (`packages/shared/src/actions.ts`) to substitute tokens
(URL-encoding for `open-url`) before the action runner executes it. `resolveQuery` decides between
normal results and the argument-capture state. All of this is pure and lives in `shared`.

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

## Non-goals / follow-ups

- electron-builder packaging (`electron-builder.yml`) is scaffolded but not a focus; add signing
  + icons before shipping installers.
- Backend `/sync` and `/auth` are stubs (shape-validated, no real persistence/auth yet).
- SQLite is the dev default; Postgres is supported structurally (swap the driver in
  `apps/backend/src/db/index.ts` + `drizzle.config.ts`).
