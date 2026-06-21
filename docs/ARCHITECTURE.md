# Architecture

How CockpitZero is structured and why. Pairs with [CLAUDE.md](../CLAUDE.md) (conventions and
extension recipes); this doc covers the layering and data flow.

## Principles

- **Schemas are the source of truth.** All domain types are inferred from Zod schemas in
  `packages/shared`; apps never hand-write or duplicate them.
- **Clean, dependency-inverted layers (desktop main).** Pure domain logic lives in `shared`; the
  main process is split into _services_ (use cases), _infra_ (electron/OS adapters), _windows_, and
  a thin _ipc_ layer. Side effects are reached only through injected ports, so business logic is
  unit-testable without electron.
- **Atomic design (renderer).** UI is composed bottom-up: atoms → molecules → organisms →
  templates → screens, with stateful logic extracted into hooks. Screens are thin compositions.

## The shared domain core (`packages/shared`)

| File         | Responsibility                                                                          |
| ------------ | --------------------------------------------------------------------------------------- |
| `schemas.ts` | Zod schemas — actions (discriminated union), aliases, workflows, settings.              |
| `types.ts`   | Types inferred from schemas (`Action`, `Config`, …) + the `LauncherItem` result union.  |
| `actions.ts` | Pure Level-2 helpers: `effectiveArguments`, `applyArguments`, `splitArgumentValues`.     |
| `search.ts`  | `fzf`-backed `fuzzyRank` (generic), `searchConfig`/`searchActions`, and `resolveQuery`. |
| `ipc.ts`     | The `IpcChannels` + `IpcApi` contract shared by main and preload.                       |
| `config.ts`  | `validateConfig` / `defaultConfig`.                                                     |

Both the desktop main process and the renderer reuse these — e.g. the launcher previews a
parameterized action with the same `applyArguments` the main process uses to execute it, and the
generic `fuzzyRank` ranks actions, apps and files with one algorithm.

### The result model — `LauncherItem`

A launcher row is **not** always a configured action. `LauncherItem` is a discriminated union on
`kind` so the bar can show heterogeneous results from different sources:

| `kind`     | Extra fields | Source                               | Run via           |
| ---------- | ------------ | ------------------------------------ | ----------------- |
| `action`   | `action`     | config (`searchConfig`, in `shared`) | `runAction(id)`   |
| `workflow` | `workflow`   | config (`searchConfig`, in `shared`) | `runWorkflow(id)` |
| `app`      | `path`       | system (apps-provider, in `main`)    | `openPath(path)`  |
| `file`     | `path`       | system (files-provider, in `main`)   | `openPath(path)`  |

`shared` stays **pure and config-only** (actions + workflows); installed apps and files are produced
by providers in the main process and merged in — keeping OS access out of `shared`.

## Desktop main process (`apps/desktop/src/main`)

```
app/        bootstrap (composition root) + hotkey registration
services/   use cases:
              config-service   read/update config (+ live hotkey re-register)
              search-service   resolveQuery against config, then merge system results
              action-runner/   runAction dispatcher → registry → handlers/ (one per type)
                ports.ts       ActionPorts interface (owned by the use case)
              workflow-runner  runs a workflow's steps in sequence (via action-runner)
              search/          system-search engine:
                provider.ts        SearchProvider + AppEntry/FileEntry ports
                apps-provider.ts   ranks installed apps (cached) via fuzzyRank
                files-provider.ts  ranks OS-index file hits (min-length gated)
                aggregate.ts       merge/dedupe/section-order config + apps + files
infra/      adapters (the ONLY electron/OS-touching code):
              store.ts            electron-store persistence
              electron-ports.ts   ActionPorts impl (shell/clipboard/spawn)
              app-scanner.ts      list installed apps (mac dirs / win Start-Menu)
              file-search.ts      file search (mac `mdfind` / win Search index)
windows/    launcher + settings BrowserWindows
ipc/        ipcMain handlers — thin; validate + delegate to services
```

**Dependency inversion** is used twice. The **action runner** + **workflow runner** depend on the
`ActionPorts` interface, not electron (`infra/electron-ports.ts` is the impl; tests pass fakes). The
**search providers** depend on injected `ScanInstalledApps` / `SearchFiles` adapters
(`infra/app-scanner.ts`, `infra/file-search.ts`); tests pass fake lists. That's how every desktop
test stays electron-free — and, for system search, free of any FS / `child_process` access. Adding
an action type makes the `registry.ts` mapped type error until a handler is supplied (exhaustive by
construction).

**System search, cross-platform.** Apps: macOS scans `/Applications` (+ `…/Utilities`,
`/System/Applications`, `~/Applications`) for `.app` bundles; Windows walks the Start-Menu tree for
`.lnk` shortcuts; the scan is cached with a short TTL. Files: macOS uses Spotlight (`mdfind`),
Windows queries the Search index (`SystemIndex`) via PowerShell — each call is time-boxed and
degrades to `[]` on any error so a slow/disabled index never blocks the bar. Linux returns empty
for both (the pattern is left open to add `.desktop` scanning later).

## Renderer (`apps/desktop/src/renderer`)

```
components/atoms        Input, Button, Select, Toggle, Field, Badge, Kbd, EmptyState
components/molecules    SearchField, ResultRow, ResultIcon, ArgumentChip, ActionTypeBadge, HotkeyRecorder
components/organisms    ResultList, ArgumentCapture, ActionForm, ActionList, AliasEditor,
                          WorkflowEditor, WorkflowForm, SettingsPanel
components/templates    LauncherLayout, SettingsLayout
screens                 LauncherBar, Settings  (thin composition)
hooks                   useConfig, useLauncherSearch, useKeyboardNav, useDebouncedValue, useTheme
lib                     api (dev-gated preload bridge), highlight, format, cn
```

`ResultRow` renders any `LauncherItem` (icon + highlighted title + subtitle + kind badge);
`ResultList` groups rows into labelled sections (Actions / Workflows / Applications / Files) while
keyboard nav stays a flat index because the merged list is already section-ordered. `lib/api.ts`
falls back to a mock bridge **only in dev** — in production a missing `window.api` throws, surfacing
a real preload failure instead of silently no-oping.

Theming is CSS variables exposed to Tailwind v4 via `@theme` (`bg-surface`, `text-fg`, `bg-accent`,
…); `useTheme` swaps the palette by toggling `theme-dark` / `theme-light` on the document root.

## Data flow — a keystroke to an action

```
user types in LauncherBar
  → useLauncherSearch (debounced) → window.api.resolveQuery(input)
    → preload bridge → ipcMain(resolveQuery) → search-service.resolveLauncherQuery
      → shared resolveQuery(input, config)   (pure: argument-capture vs config results)
        ├─ { kind: 'argument' }  → ArgumentCapture (chip + live preview)
        └─ { kind: 'results' }   → also fan out to system providers, then merge:
             ├─ apps-provider.search  (cached scan, fuzzyRank)
             └─ files-provider.search (OS index, time-boxed)   ⟶ aggregate.mergeResults
           → ResultList (sectioned: Actions / Workflows / Applications / Files)
user presses Enter (run by item kind)
  → action   → window.api.runAction(id, values?) → applyArguments → action-runner → handler → OS
  → workflow → window.api.runWorkflow(id)           → workflow-runner → action-runner per step
  → app/file → window.api.openPath(path)            → shell.openPath
```

Config edits in the settings window flow the other way: `useConfig.save` → `window.api.setConfig`
→ `config-service.updateConfig` (persists via `store`, re-registers the hotkey if it changed). The
Workflows tab (`WorkflowEditor`) writes `config.workflows` through the same path.

## Code intelligence (codegraph)

The repo is indexed by [codegraph](https://www.npmjs.com/package/codegraph) (`.codegraph/`,
git-ignored). It's a local SQLite knowledge graph of every symbol/edge — query it (via the MCP
server, or `codegraph query`/`callers`/`impact`) before editing to trace call paths and blast
radius. Refresh after large changes with `codegraph sync`. It is purely an authoring aid; nothing at
runtime depends on it.
