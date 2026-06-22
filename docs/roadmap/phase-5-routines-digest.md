# Phase 5 — Routines & the notification digest

> **Status:** 🔜 Next · **Screen:** `mockups/routine-digest.html` ·
> **Depends on:** [Phase 1](phase-1-ai-foundation.md) (AiService, for summarize/rank). Reads
> `ai.tools` grants from [Phase 3](phase-3-cockpit-ai-settings.md) when available.

The bridge from "I summon the launcher" to "the launcher comes to me." A **routine** is a proactive
job you set up once that runs on its own. The flagship: a **notification digest** that pulls messages
across your tools, then **summarizes and ranks** them into one briefing — _needs you now_ / _can wait_
/ _noise_. This is the largest phase; it introduces a whole subsystem (schema, scheduler, source
providers, a delivery surface). **Recommended to split into 5a (engine) and 5b (digest UI).**

## Goal

A `morning_digest` routine, configured to pull from a set of sources on a schedule, runs (manually
or on cron), fans out to source providers (mock adapters first), feeds the items through the AI to
summarize + rank, and delivers a **digest surface** matching `routine-digest.html`: a serif
"Morning briefing" header with a live "Routine" pulse, grouped items (Needs you now / Can wait), and a
muted "low-priority" roll-up, each item runnable (`↵ open`, `e archive`, `r reply with AI`).

## Scope

**In**

- 5a — **Engine.** `RoutineSchema` + a `routines` array in `ConfigSchema`; a routine **runner** in
  main; a **scheduler** (cron) that fires scheduled routines; **source provider** ports with **mock
  adapters** (slack/gmail/teams/linear) under `infra/`; an AI **summarize + rank** step via
  AiService; a `runRoutine` / `getDigest` IPC surface. Minimal "Routines" settings tab to list/toggle.
- 5b — **Digest surface.** A new window/surface rendering the latest digest (grouped, ranked,
  keyboard-operable). Delivery target `launcher` (in-bar) or its own briefing window — pick one;
  the mockup is a standalone panel.

**Out**

- Real integrations (actual Slack/Gmail/Teams APIs, OAuth) — define the provider port; ship **mock
  adapters** returning canned items (use the mockup's people/sources). Real adapters are follow-ups.
- The AI actually replying/archiving with side-effects (`r reply with AI`) — that's Phase 7's tool
  layer; here the keys are wired but reply/archive can be stubs/local-only.
- Arbitrary user-authored routine *types* — ship the digest routine; the schema is general but only
  the digest runner is implemented.

## Data model & schema changes

`packages/shared/src/schemas.ts` — a general routine plus the digest specifics:

```ts
export const RoutineSourceId = z.enum(['slack', 'gmail', 'teams', 'linear', 'github', 'notion']);

export const RoutineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),                       // "Notification digest"
  kind: z.literal('digest').default('digest'),    // only digest implemented now; leave room
  sources: z.array(RoutineSourceId).default([]),
  rankBy: z.enum(['importance', 'recency']).default('importance'),
  /** cron expression; absent = on-demand only (the mockup's standup_prep). */
  schedule: z.string().optional(),
  trigger: z.enum(['scheduled', 'on_demand']).default('on_demand'),
  deliver: z.enum(['launcher', 'window', 'doc']).default('launcher'),
  summarize: z
    .object({ modelTier: AiModelTier.default('mini'), maxItems: z.number().int().default(8) })
    .default({ modelTier: 'mini', maxItems: 8 }),
});

// ConfigSchema: routines: z.array(RoutineSchema).default([]),
```

The **digest result** (what the surface renders) is a runtime type, not persisted config:

```ts
// types.ts
export interface DigestItem {
  id: string;
  who: string;                 // "Priya Shah"
  source: RoutineSourceId;     // badge "Slack"
  summary: string;             // one-line AI summary
  when: string;                // "12m"
  bucket: 'now' | 'wait' | 'noise';
  score: number;               // rank
  openPath?: string;           // deep link / app path when openable
}
export interface Digest {
  routineId: string;
  title: string;               // "Morning briefing"
  updatedAt: string;           // "8:42 AM"
  sourceCount: number;
  surfaced: number; total: number;   // "20 of 41 surfaced"
  groups: { now: DigestItem[]; wait: DigestItem[]; noiseCount: number };
}
```

> This pairs with the `yaml-config` mockup, which edits exactly this as `routines.yaml`. Keep the
> field names aligned so Phase 6 can serialize the same schema (`sources`, `rank_by`, `schedule`,
> `deliver`, `summarize.model`, `summarize.max_items`).

## IPC channels (four-step recipe)

```ts
// IpcChannels
runRoutine: 'routine:run',
getDigest:  'routine:get-digest',
listRoutines: 'routine:list',

// IpcApi
runRoutine(routineId: string): Promise<Digest>;
getDigest(routineId: string): Promise<Digest | null>;   // last computed
listRoutines(): Promise<Routine[]>;
```

If delivery is its own window, add a window-open channel (`window:open-digest`) following the
existing `openSettings` pattern + an `electron.vite.config.ts` HTML entry (CLAUDE.md: multi-entry).

## Main-process work

- **Source ports** — `services/routines/source.ts`: `interface NotificationSource { id; fetch(since): Promise<RawItem[]> }`. Implement `infra/routines/<id>-source.ts` as **mock adapters** (canned items, time-boxed, degrade to `[]` — same discipline as the search providers). Real adapters slot in later behind the same port.
- **Digest runner** — `services/routines/digest-runner.ts`: fan out to the routine's sources in
  parallel (`Promise.allSettled`), collect `RawItem`s, call `AiService` to **summarize each** and
  **assign a bucket + score** (`rankBy`), cap to `summarize.maxItems`, roll the rest into `noiseCount`.
  Returns a `Digest`. Mock provider gives deterministic summaries/ranks for tests.
- **Scheduler** — `services/routines/scheduler.ts`: register cron timers for routines with a
  `schedule`; on fire, run the digest runner and deliver (notify the renderer / open the surface).
  Use a small cron lib or a timer abstraction; keep it injectable and `electron`-free in tests.
  Respect "fast by default" — never block the launcher; this runs in the background.
- `ipc/index.ts` — handle `runRoutine` / `getDigest` / `listRoutines`.

## Renderer work

**5b — the digest surface** (mirrors `routine-digest.html`):

- **Organism `DigestPanel`** — serif `h1` "Morning briefing"; meta line "Updated 8:42 AM · 5 sources ·
  20 of 41 surfaced"; a "Routine" pill with a pulsing dot (`--cz-glow-chip`, `prefers-reduced-motion`
  off).
- **Groups** — `Needs you now` (accent label + count chip) and `Can wait` (neutral). The top item in
  "now" gets the selected treatment: `--cz-glass-selected` wash + `inset 2px 0 0 --cz-accent` left
  rail.
- **Item molecule `DigestRow`** — avatar/source glyph chip, name + uppercase source badge, one-line
  summary (`--cz-fg-muted`, `text-wrap: pretty`), right-aligned mono relative time.
- **Noise roll-up** — a muted `--cz-glass-2` card: bell glyph + "12 low-priority items — newsletters,
  CI passes, automated digests" + "Muted".
- **Footer hints** — `↵ open` / `e archive` / `r reply with AI`. Wire `↵`→`openPath`; `e`/`r` can be
  local/stub until Phase 7.
- **Keyboard** — reuse `useKeyboardNav` across the flattened item list (skip group headers).

**Settings (minimal)** — a "Routines" tab listing routines with an enable toggle and a "Run now"
button (`runRoutine`). Add `'routines'` to `TABS` (and it becomes the nav item the `cockpit-ai`
mockup hints at). Full routine authoring UI can be deferred to the YAML editor (Phase 6).

## Design reference (from `routine-digest.html`)

- **Panel:** standard `.cz-glass`, 760px. Header serif 34px; "Routine" pill uppercase
  `--cz-accent-bright` with pulsing 8px dot.
- **Group label:** uppercase `.14em`; "now" group label + count use `--cz-accent-bright` /
  `--cz-accent-soft`; "wait" stays neutral.
- **Top item:** `background: --cz-glass-selected; border: --cz-accent-line; box-shadow: inset 2px 0 0 --cz-accent;`
- **Source badge:** tiny uppercase chip `--cz-glass-2` / `--cz-line`.
- **Noise card:** `--cz-glass-2` fill, `--cz-line-faint` border; bell glyph `--cz-fg-subtle`.
- **One accent moment:** the top "needs you now" item. Everything else warm-neutral.
- **Voice:** descriptive third-person summaries; group names "Needs you now / Can wait"; "Muted".

## Acceptance criteria

- [ ] `RoutineSchema` + `routines` in config; old configs default to `[]`.
- [ ] `runRoutine('morning_digest')` fans out to (mock) sources, summarizes + ranks via AiService,
      returns a `Digest` bucketed into now/wait + a noise count, capped at `maxItems`.
- [ ] The digest surface renders groups, the selected top item, source badges, relative times, and
      the noise roll-up per the mockup.
- [ ] A scheduled routine fires on its cron without blocking the launcher; on-demand routines run via
      "Run now".
- [ ] `↵` opens an item; keyboard nav moves through items across groups.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `packages/shared`: `RoutineSchema` defaults/parse; `Digest` shape.
- `apps/desktop/test/digest-runner.test.ts`: inject fake sources + the mock AiService → assert
  bucketing, ranking, cap, and noise count. `electron`-free.
- Scheduler test with a fake clock: a routine with a cron fires the runner; on-demand does not.
- Manual parity pass on `routine-digest.html`.

## Risks / open questions

- **Scope** — this is the biggest phase. Land **5a (engine + mock sources + Run now + a basic
  surface)** first, then **5b (polish the digest surface + scheduler delivery)**. Don't attempt real
  integrations in this phase.
- **Delivery target** — `launcher` (render the digest in the bar) vs a dedicated briefing window. The
  mockup is a standalone panel; a separate window is cleaner but adds a vite entry. Pick one and note
  it; default to a dedicated window for the digest.
- **Privacy** — pulling cross-tool notifications is sensitive. Gate sources behind explicit grants
  (reuse `ai.tools` / per-source consent), keep raw items local, and only send minimal text to the
  model. Honor local-first.
- **Cron reliability** — handle sleep/wake and missed runs; a missed scheduled run should run on next
  wake, not silently skip. Keep it simple but correct.
