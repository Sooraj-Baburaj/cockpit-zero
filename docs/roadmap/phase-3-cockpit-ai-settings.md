# Phase 3 — Cockpit AI settings (the management window's AI tab)

> **Status:** 🔜 Next · **Screen:** `mockups/cockpit-ai.html` ·
> **Depends on:** [Phase 1](phase-1-ai-foundation.md) (the `ai` config block). Best sequenced
> right after [Phase 2](phase-2-ai-mode-and-ask.md), whose behavior these controls govern.

Makes the AI real and user-tunable. The Settings window gains an **AI** tab: an inline composer to
ask from inside the cockpit, a default-model segmented control, behavior toggles ("Ask AI from the
bar", "Memory & history"), and a grid of per-tool grants. Every control reads/writes the `ai` block
Phase 1 added, so Phases 2/4/5/7 honor it.

## Goal

Open Settings → **AI** and see: a sienna-edged composer with prompt chips; an **Engine** group with a
Mini / Pro / Bring-your-own segmented control bound to `ai.modelTier`; a **Behavior** group with two
toggles bound to `ai.askFromBar` and `ai.memoryEnabled`; and a **Tools** grid of toggles bound to
`ai.tools`. Saving persists via the existing config flow; the launcher's AI mode (Phase 2) reacts
immediately.

## Scope

**In**

- A new `AppearancePanel`-style organism `AiPanel` rendered by the Settings screen.
- A new nav tab "AI" wired into the `TABS` array (CLAUDE.md gotcha: nav order lives in
  `screens/Settings.tsx`). The mockup's nav order is General → **AI** → Aliases → Workflows →
  Routines → Scripts; match the product's actual tab set (Routines arrives in Phase 5; Scripts is
  out of scope — only add tabs that exist).
- Binding every control to `config.ai.*` through the existing `useConfig` + `setConfig` path.
- A connection/status chip ("Connected · cockpit-pro") fed by `aiStatus()`.
- The inline composer routes to the same `askAI` flow (or opens the launcher in AI mode) — reuse,
  don't fork.

**Out**

- Real model-tier → API wiring and "Bring your own" key entry UI (define the control; key capture is
  deferred with the real provider — keep secrets out of `config.json`).
- Tool _execution_ (Phase 7). Here the tool toggles only persist grants in `ai.tools`.
- The composer producing a full chat transcript — it kicks off an ask; rich conversation is later.

## Data model & schema changes

None — Phase 1 defined `AiSettingsSchema` (`enabled`, `provider`, `modelTier`, `askFromBar`,
`memoryEnabled`, `tools`). This phase is pure UI binding. If "Bring your own" needs a key field,
**don't** add it to `ConfigSchema`; plan a secure-store-backed field and leave a `// TODO` — never
persist secrets in the synced config.

## IPC channels

Reuse `getConfig` / `setConfig` (existing) and `aiStatus` (Phase 1). The composer reuses `askAI`.
No new channels.

## Main-process work

None required beyond what exists. (`aiStatus` already added in Phase 1.) Optionally have `aiStatus`
report the resolved model label for the connection chip.

## Renderer work

- **Screen.** `screens/Settings.tsx` — add `'ai'` to `TABS` (place after `general`/`actions` per the
  product's existing order; the mockup shows it second). Render `<AiPanel />` for that tab. The
  initial tab must remain a member of `TABS`.
- **Organism `AiPanel`** (mirrors `cockpit-ai.html` `.content`):
  - **Composer** — sienna-edged card (`--cz-accent-line` border, `--cz-glow-accent-soft`), spark
    icon, a text input (placeholder "Ask CockpitZero anything, or describe a task…"), dark **Ask**
    button, and a wrap of prompt `pchip`s ("Summarize my unread", "Draft a workflow", "Build a deck
    from a brief", "What changed in Apollo today?"). Clicking Ask / a chip triggers `askAI`.
  - **Engine** group — `grp-lbl` "Engine" + an `.opt` row "Default model" / "Powers Ask AI, drafted
    workflows, and routine summaries." with a **segmented control** bound to `ai.modelTier`. Reuse the
    existing `SegmentedTabs` component if present, else build a small segmented molecule (the design
    system has a `SegmentedTabs`).
  - **Behavior** group — two `.opt` rows with the existing `Toggle` atom: "Ask AI from the bar" →
    `ai.askFromBar`; "Memory & history" → `ai.memoryEnabled`. Use the exact subtitles from the mockup.
  - **Tools** group — a 2-col grid of tool cards (icon chip + name + sub + `Toggle`) over `ai.tools`:
    Files (Read & search), Calendar (Read events), Slack (Read & post), Slides & Sheets (Create &
    edit). Toggling adds/removes the `AiToolId` from the array.
  - **Footer** — note "Local-first · anything that leaves your machine is explicit and minimal." +
    **Save changes** (only enabled when dirty, matching the rest of Settings).
- **Header** — serif "AI" `h1` + the `conn` status chip from `aiStatus()`.
- **Atoms/molecules** — reuse `Toggle`, `Button`, `Field`, `Badge`, `SegmentedTabs`. Add a
  `ToolGrantCard` molecule if it tidies the grid.

## Design reference (from `cockpit-ai.html`)

- **Window:** existing settings window frame; left nav 214px, content scrolls, sticky footer with
  Save. Header serif `h1` 36px; nav active item `background: --cz-glass-3`, active icon `--cz-accent`.
- **Composer card:** `border: 1px solid --cz-accent-line; box-shadow: --cz-shadow-md, --cz-glow-accent-soft;` radius `--cz-radius-lg`; **Ask** button dark `#3a302a` fill, `#fffaf3` text (the warm-dark primary used across roadmap CTAs).
- **`.opt` row:** warm-white card, `--cz-shadow-sm`, `--cz-radius-md`; title 14.5px/600, desc 13px `--cz-fg-muted` max 52ch.
- **Segmented control:** pill track `--cz-glass-2`; the selected segment uses `--cz-accent-grad` fill, `--cz-accent-fg` text, `--cz-glow-accent`.
- **Toggle "on":** `--cz-accent-grad` track, knob translateX(18px) — match the existing `Toggle`
  atom's on-state (already sienna in the Sahara renderer).
- **One accent moment caveat:** this screen is denser than a launcher view; keep accent to the
  composer edge + the _on_ states. Off controls stay warm-neutral.
- Voice: imperative, terse. Buttons "Ask", "Save changes". No emoji.

## Acceptance criteria

- [ ] An "AI" tab appears in Settings nav and renders `AiPanel`.
- [ ] Segmented control reflects and updates `ai.modelTier`; toggles reflect/update `ai.askFromBar`,
      `ai.memoryEnabled`; tool grid reflects/updates `ai.tools`.
- [ ] **Save changes** persists via `setConfig`; reopening shows the saved values; Phase 2's AI mode
      respects the new `askFromBar` immediately.
- [ ] Connection chip reflects `aiStatus()` (enabled/provider).
- [ ] Composer Ask / prompt chips invoke `askAI` (or open the launcher in AI mode).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- Config round-trip: mutate each control → `setConfig` payload has the expected `ai` block →
  re-read renders it. Test the pure mapping (control value ↔ schema field) where possible.
- Tab registration test: `'ai'` is in `TABS`, initial tab still valid.
- Reuse/extend the settings panel tests if they exist; otherwise a manual parity pass against
  `cockpit-ai.html`.

## Risks / open questions

- **"Bring your own" key** — needs a secure input + storage story (OS keychain / `safeStorage`), not
  the synced JSON. Ship the segmented option disabled-with-tooltip or as a no-op until the real
  provider lands; don't build a plaintext key field.
- **Tab set drift** — only add nav tabs that exist in the product. "Routines" should appear once
  Phase 5 lands; "Scripts" in the mockup is aspirational — omit unless implemented.
- **Composer scope creep** — resist turning it into a full chat panel here; it's an entry point to
  the existing ask flow.
