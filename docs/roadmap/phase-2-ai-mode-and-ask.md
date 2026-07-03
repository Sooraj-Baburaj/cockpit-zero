# Phase 2 — AI mode + Ask AI (a model behind the bar)

> **Status:** 🔜 Next · **Screens:** `mockups/ai-mode.html`, `mockups/ai-ask.html` ·
> **Depends on:** [Phase 1](phase-1-ai-foundation.md) (AiService, `askAI`, `ai` config block).

The first visible AI surface. Two states of one flow: when a query matches **no** action/app/file,
the bar shifts into **AI mode** and offers "Ask AI"; running it streams an **answer + suggested
actions** back into the bar. Keyboard-first throughout; the instant local launcher is never blocked.

## Goal

Type a natural-language query the library can't satisfy → the panel grows a sienna top rail + an
"AI mode" pill, shows the empty-state line, and offers one **Ask** row. Press `↵` → an **Answer**
block fills in (prose + provenance meta) followed by a **Suggested actions** list whose top row is
selected and runnable with `↵` (and `⌘↵` runs all). `⌫` returns to search, `Esc` dismisses.

## Scope

**In**

- A new launcher state in the resolve/search flow: `ai-offer` (no matches + `ai.askFromBar`) and
  `ai-answer` (after asking).
- Wiring `askAI` → render an `AiAnswer` (answer body, meta, suggestions).
- Running a suggested action: real config actions via `runAction`; AI-only suggestions show but are
  display-only (or run via a follow-up — see Out).
- AI-mode chrome: top rail, "AI mode" pill, spark icon, footer hint swap.
- Respect `ai.enabled` / `ai.askFromBar`: when off, fall back to today's "No matching actions" empty
  state with no AI offer.

**Out**

- Token-by-token streaming (Phase 1 resolved once; the caret is cosmetic). Optional later.
- Drafting workflows (Phase 4) and multi-step agentic tasks (Phase 7) — different surfaces.
- Executing AI-only suggestions that aren't config actions (e.g. "Draft reply to Priya") — show them;
  wiring real side-effects is Phase 7's tool layer. Keep them non-runnable or open-a-composer stubs.

## Data model & schema changes

None beyond Phase 1. Reuse `AiAnswer` / `AiSuggestedAction`. The launcher state is renderer-local
(a discriminated state in the search hook), not persisted config.

## IPC channels

Reuse Phase 1's `askAI` and `aiStatus`. No new channels. Running suggestions reuses the existing
`runAction` / `openPath`.

## Main-process work

Minimal — Phase 1 did the heavy lifting. Confirm `resolveLauncherQuery` still returns config matches
synchronously and that "no results" is distinguishable by the renderer (empty `results` array). The
decision to enter AI mode is **renderer-side** (it knows both the config result and the async system
result), so main needs no change beyond Phase 1's `askAI`.

## Renderer work

This is the bulk of the phase. Atomic-design layering:

- **State (`hooks/useLauncherSearch.ts` or a sibling `useAiMode.ts`).** Extend the merge logic: once
  both config (`resolveQuery`) and system (`searchSystem`) resolve to **empty** for a non-empty plain
  query, and `config.ai.enabled && config.ai.askFromBar`, surface an `ai-offer`. On Enter from the
  offer, call `askAI(query)`, transition to `ai-answer`, store the `AiAnswer`. `Backspace` on an
  empty-but-for-AI state returns to `results`; `Esc` hides (existing behavior).
- **Organisms.**
  - `AiOfferPanel` (matches `ai-mode.html`): top `.aibar` rail, the empty-state row (reuse/extend the
    `EmptyState` atom), and the single "Ask «query»" row with the lit accent icon chip + `↵ ask`.
  - `AiAnswerPanel` (matches `ai-ask.html`): the `Answer` label + meta line + prose body, then a
    `Suggested actions` `SectionLabel` and a list of `ResultRow`-like rows with badges (`Draft` /
    `App` / `Task`) and a `↵ run` affordance on the selected row.
- **Molecules.** Add an `AiModePill` (the uppercase "AI mode" chip with spark), and a `Sparkle` icon
  to the shared icon set (`ResultIcon` or a new `icons` module) — the 4-point sparkle path from the
  mockups. Extend `Badge` to cover the new badge variants (`b-accent` / `b-neutral`).
- **Templates.** `LauncherLayout` already frames the panel; add an `aiMode` flag that applies the
  accent edge + top rail and swaps the footer hints (`↵ ask` / `⌫ back to search` / `esc dismiss` for
  offer; `↵ run` / `⌘↵ run all` / `↑↓ navigate` for the answer).
- **Keyboard.** Reuse `useKeyboardNav` for the suggestions list. Add `⌘↵` = run all suggested
  (sequence the runnable ones), `⌫` = back, `Esc` = dismiss.

## Design reference (from the mockups)

Pull exact values from `mockups/ai-mode.html` and `mockups/ai-ask.html`; key specs:

- **AI-mode panel edge:** `box-shadow: var(--cz-shadow-panel), var(--cz-rim-inset), var(--cz-glow-accent-soft); border-color: var(--cz-accent-line);` plus a 2px `.aibar` of `--cz-accent-grad` at the very top.
- **AI-mode pill:** uppercase, `.12em` tracking, `color: --cz-accent-bright`, `background: --cz-accent-soft`, `border: --cz-accent-line`, full radius, spark glyph 13px.
- **Spark icon:** `viewBox 0 0 24 24`, stroke `currentColor` 1.6, the two-star path in `.spark` — `--cz-accent`, 24px in the search row.
- **Answer block:** top border `--cz-line-faint`; label `Answer` uppercase `--cz-accent-bright`; meta line in mono `--cz-fg-subtle`; body 16px/1.62, `max-width: 60ch`, bold via `<b>`.
- **Selected suggestion:** `background: --cz-accent-soft; border: --cz-accent-line; box-shadow: var(--cz-ring-focus);` icon chip lit with `--cz-accent-grad` + `--cz-glow-chip`; `↵ run` chip in mono `--cz-accent-bright`.
- **Copy (verbatim):** offer empty state — "No matching actions, apps, or files" / "Nothing in your
  library matches — hand it to the assistant instead."; the ask row — `Ask "«query»"` with subtitle
  "CockpitZero AI · answers from your workspace and history". Keep the terse, tool-like voice (no
  "we", imperative verbs).
- **One accent moment per view** — in the answer view that's the selected suggestion row; don't also
  accent the answer text.

## Acceptance criteria

- [ ] A query with zero config + zero system results, with AI enabled, shows the AI-mode panel
      (rail + pill + empty line + single Ask row).
- [ ] With `ai.askFromBar = false` (or `ai.enabled = false`), the same query shows today's plain
      empty state and **no** AI offer.
- [ ] `↵` on the Ask row calls `askAI` and renders the answer + suggestions; the first suggestion is
      selected.
- [ ] `↵` runs the selected suggestion when it's a real config action; `↑↓` moves selection.
- [ ] `⌫` returns to the normal results/search; `Esc` hides the launcher.
- [ ] Footer hints match the mockup per state. Reduced-motion disables the caret/animations.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- Pure state logic (in `shared` or a renderer-testable module): given empty config+system results +
  AI flags → `ai-offer`; after answer → `ai-answer`; backspace/escape transitions. Keep it
  framework-light so it runs in Node.
- Component test (if the repo has renderer component tests) or a manual checklist using the mockup
  for visual parity. Mock `window.api.askAI` with the Phase 1 mock’s shape.
- Verify the `useLauncherSearch` change doesn't delay or block the instant config-results path.

## Risks / open questions

- **When exactly to offer AI** — only after _both_ config and system search resolve empty, to avoid
  flashing the AI offer before the slow file index returns. Gate on both promises settling.
- **AI-only suggestions** that aren't config actions — for this phase, render them but make them
  non-runnable (or route to a "coming in Phase 7" no-op). Don't fake side-effects.
- **Latency UX** — show a subtle in-panel pending state between Ask and Answer (the mockup's caret).
  Keep it from shifting layout jarringly.
