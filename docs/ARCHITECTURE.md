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

| File         | Responsibility                                                             |
| ------------ | -------------------------------------------------------------------------- |
| `schemas.ts` | Zod schemas — actions (discriminated union), aliases, workflows, settings. |
| `types.ts`   | Types inferred from schemas (`Action`, `Config`, `ResolvedQuery`, …).      |
| `actions.ts` | Pure Level-2 helpers: `hasArgument`, `applyArgument`, `extractTokens`.     |
| `search.ts`  | `fzf`-backed `searchActions`, `buildSearchIndex`, and `resolveQuery`.      |
| `ipc.ts`     | The `IpcChannels` + `IpcApi` contract shared by main and preload.          |
| `config.ts`  | `validateConfig` / `defaultConfig`.                                        |

Both the desktop main process and the renderer reuse these — e.g. the launcher previews a
parameterized action with the same `applyArgument` the main process uses to execute it.

## Desktop main process (`apps/desktop/src/main`)

```
app/        bootstrap (composition root) + hotkey registration
services/   use cases:
              config-service   read/update config (+ live hotkey re-register)
              search-service   resolveQuery against current config
              action-runner/   runAction dispatcher → registry → handlers/ (one per type)
                ports.ts       ActionPorts interface (owned by the use case)
infra/      adapters (the ONLY electron-touching code):
              store.ts            electron-store persistence
              electron-ports.ts   ActionPorts impl (shell/clipboard/spawn)
windows/    launcher + settings BrowserWindows
ipc/        ipcMain handlers — thin; validate + delegate to services
```

**Dependency inversion in the action runner:** handlers depend on the `ActionPorts` _interface_,
not electron. `infra/electron-ports.ts` provides the real implementation; tests pass fakes
(`test/action-runner.test.ts`) — which is how desktop tests stay electron-free. Adding an action
type makes the `registry.ts` mapped type error until a handler is supplied (exhaustive by
construction).

## Renderer (`apps/desktop/src/renderer`)

```
components/atoms        Input, Button, Select, Toggle, Field, Badge, Kbd, EmptyState
components/molecules    SearchField, ResultRow, ArgumentChip, ActionTypeBadge, HotkeyRecorder
components/organisms    ResultList, ArgumentCapture, ActionForm, ActionList, AliasEditor, SettingsPanel
components/templates    LauncherLayout, SettingsLayout
screens                 LauncherBar, Settings  (thin composition)
hooks                   useConfig, useLauncherSearch, useKeyboardNav, useDebouncedValue, useTheme
lib                     api (preload bridge), highlight, format, cn
```

Theming is CSS variables exposed to Tailwind v4 via `@theme` (`bg-surface`, `text-fg`, `bg-accent`,
…); `useTheme` swaps the palette by toggling `theme-dark` / `theme-light` on the document root.

## Data flow — a keystroke to an action

```
user types in LauncherBar
  → useLauncherSearch (debounced) → window.api.resolveQuery(input)
    → preload bridge → ipcMain(resolveQuery) → search-service.resolveLauncherQuery
      → shared resolveQuery(input, config)
        ├─ { kind: 'results' }   → ResultList (fzf-ranked, highlighted)
        └─ { kind: 'argument' }  → ArgumentCapture (chip + live preview)
user presses Enter
  → window.api.runAction(id, argument?)
    → ipcMain(runAction): applyArgument(action, argument) → action-runner.runAction(action, electronPorts)
      → handler (open-url / open-app / run-command / snippet) → OS
```

Config edits in the settings window flow the other way: `useConfig.save` → `window.api.setConfig`
→ `config-service.updateConfig` (persists via `store`, re-registers the hotkey if it changed).
