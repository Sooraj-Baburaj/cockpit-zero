# Production Phase 1 — Rename "Settings" → "Console"

> **Status:** 🔜 Next · **Depends on:** nothing · **Blocks:** nothing (do it first so later phases
> read cleanly). **Risk:** low — pure rename, no behavior change.

We no longer call it "Settings". The product surface where a user configures actions, AI, routines,
appearance, etc. is the **Console**. This phase renames it everywhere — user-facing strings, file
names, component names, IPC method names, and tests — with **zero behavior change**.

## Goal

Every "Settings" reference becomes "Console" (label, window title, code symbol, IPC method), the
window still opens on the same hotkey, and all tests pass. A grep for `Settings`/`settings` in the
renderer returns only the React `Settings` type that refers to the **appearance/general settings
config block** (that domain object stays `settings` — see "Out of scope").

## Scope

**In**

- User-facing copy: window title `CockpitZero Settings` → `CockpitZero Console`; the launcher footer
  button `Settings` → `Console`; any "Settings → X" prose in tooltips/empty-states.
- File renames (keep them mechanical):
  - `renderer/screens/Settings.tsx` → `Console.tsx` (export `Console`)
  - `renderer/settings.tsx` → `console.tsx`, `renderer/settings.html` → `console.html`
  - `renderer/screens/settings-tabs.ts` → `console-tabs.ts` (`SETTINGS_TABS`→`CONSOLE_TABS`,
    `INITIAL_SETTINGS_TAB`→`INITIAL_CONSOLE_TAB`, type `SettingsTab`→`ConsoleTab`)
  - `renderer/components/templates/SettingsLayout.tsx` → `ConsoleLayout.tsx`
  - `renderer/components/organisms/SettingsPanel.tsx` → `ConsolePanel.tsx`
  - `main/windows/settings-window.ts` → `console-window.ts`
  - `test/settings-tabs.test.ts` → `console-tabs.test.ts`
- IPC rename: channel `openSettings: 'window:open-settings'` → `openConsole: 'window:open-console'`;
  `IpcApi.openSettings()` → `openConsole()`; preload method; the `LauncherBar.openSettings` handler →
  `openConsole`. Update `ipc-contract.test.ts`.
- `electron.vite.config.ts` renderer entry `settings:` → `console:` (pointing at `console.html`).
- Update `CLAUDE.md` references ("Settings nav order", "Settings → Workflows", etc.) to "Console".

**Out of scope (do NOT rename)**

- The `settings` **config block** in `ConfigSchema` (`SettingsSchema`, `config.settings`,
  `AppearancePanel`'s `Settings` type, `updateSettings`). That's the appearance/general **domain
  object** — renaming it is a schema migration with no user value. Leave `config.settings` as-is.
  Only the _window/screen/navigation_ concept becomes "Console".

## Data model & schema changes

None. (`config.settings` stays.)

## IPC channels

Rename one channel + method (four-step recipe, in reverse — it already exists):

```ts
// packages/shared/src/ipc.ts
openConsole: 'window:open-console',   // was openSettings: 'window:open-settings'
// IpcApi
openConsole(): Promise<void>;          // was openSettings()
```

Then update `main/ipc/index.ts` handler, `preload/index.ts` method, `renderer/lib/api.ts` dev mock,
and the `LauncherBar` caller.

## Main-process work

- Rename `settings-window.ts` → `console-window.ts`; update its `title` to `CockpitZero Console` and
  any exported `createSettingsWindow`/`openSettingsWindow` → `…Console…`. Update imports in
  `main/index.ts` / `main/ipc/index.ts`.

## Renderer work

- Rename the files above; update all imports. Update `console.html`'s `<title>` and the script src to
  `console.tsx`.
- Footer button label + `aria-label` → "Console" (`LauncherFooter.tsx`).
- Keep the `⌘,` / `Ctrl+,` shortcut; it now calls `openConsole`.

## Acceptance criteria

- [ ] The window title bar reads **CockpitZero Console**; the footer button reads **Console**.
- [ ] `⌘,` / `Ctrl+,` and the footer button both open the Console window.
- [ ] `grep -rin "settings" apps/desktop/src` returns only the `config.settings` domain object and
      its `Settings`/`SettingsSchema` type — no window/screen/nav "Settings".
- [ ] `apps/desktop/test/ipc-contract.test.ts` passes with `openConsole`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- Rename `settings-tabs.test.ts` → `console-tabs.test.ts`; update symbol names; assertions unchanged.
- Update `ipc-contract.test.ts` for `openConsole`.
- No new tests — this is a rename; existing coverage proves no behavior changed.

## Risks / open questions

- **Domain `settings` vs window "Console" confusion.** The one subtlety: `config.settings` stays.
  Be surgical — rename the _navigation/window_ concept, not the appearance config object.
- **Stale doc references.** Update `CLAUDE.md` and `docs/roadmap/README.md` mentions of "Settings →"
  to "Console →" as part of this phase so the docs don't drift.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-1-rename-console.md` and `CLAUDE.md`, then implement it. This
> is a pure terminology rename of the "Settings" window/screen/navigation to **"Console"** — no
> behavior change. Crucially, do **not** rename the `config.settings` domain object / `SettingsSchema`
> (only the window/screen/nav concept). Rename files, component exports, the `openSettings` IPC
> channel→`openConsole`, the vite entry, user-facing copy, and update `CLAUDE.md`. Keep `⌘,` working.
> Run `pnpm typecheck`, `pnpm lint`, `pnpm test` before finishing.
