# Phase 7 — AI task: memory & tools (the agent layer)

> **Status:** 🧭 Exploring · **Screen:** `mockups/ai-task.html` ·
> **Depends on:** [Phase 1](phase-1-ai-foundation.md) (AiService) + [Phase 3](phase-3-cockpit-ai-settings.md)
> (reads `ai.memoryEnabled` and `ai.tools` grants). The most advanced phase — direction is set,
> details are deliberately open.

The destination: you **state an intent**, and the assistant uses **tools**, **memory**, and your
**history** to actually do the busywork, streaming its progress as a checklist of steps and handing
you a reviewable result. _"Build a deck from the Q3 brief"_ → it reads the PDF, recalls prior context,
generates slides, themes them, exports — each step shown as done / running / waiting, with a result
preview and human-in-the-loop review before anything is saved.

> **Treat this as exploratory.** Land the **agent-loop + tool-port + memory** scaffolding with a
> couple of safe local tools first; expand the tool catalog incrementally. Keep human review and
> explicit grants central — this is the phase with the most side-effect surface.

## Goal

From the bar, run a task intent → a `taskRun` starts an **agent loop**: the model plans steps, calls
**tools** (from a registry, gated by `ai.tools` grants), reads/writes **memory**, and streams step
status to the launcher's **task surface** (the `ai-task.html` checklist with done/running/waiting
markers, a live progress bar, tool tags, a result preview, and Stop / review controls). Results are
**previewed for approval** before being committed to the user's library.

## Scope

**In (scaffolding first)**

- A **tool registry + port layer**: `interface Tool { id; grant; run(input, ctx): Promise<ToolResult> }`,
  with a few **safe, local** tools to start (`files.read`, `memory.recall`, `memory.write`). Each tool
  is gated by an `ai.tools` grant and runs through an injected adapter (testable, no real network).
- A **memory store** (local, append + recall) honoring `ai.memoryEnabled`.
- An **agent loop / task runner** in main that plans → calls tools → updates step state → produces a
  result, with **streamed progress** to the renderer.
- The **task surface** (organism) matching `ai-task.html`: status header, step list with markers,
  per-step tool tag + progress, result preview tiles, Stop / Open actions, footer hints.
- Strong **human-in-the-loop**: every side-effecting tool result is previewed/approved before commit;
  `space` pauses, `esc` dismisses, `↵` previews.

**Out (until proven)**

- A large catalog of side-effecting tools (Slack post, real Slides/Sheets/Keynote export). Define the
  port; ship local read-only + memory tools first. Add external tools one at a time, each behind a
  grant + review.
- Fully autonomous, unattended execution. Always reviewable; never commit without approval for
  side-effecting steps.
- Cross-device memory sync (that rides on the backend `/sync` work, separate).

## Data model & schema changes

Mostly **runtime** types; persisted additions are small and local:

```ts
// shared types.ts — runtime task/agent shapes
export type TaskStepState = 'done' | 'running' | 'waiting';
export interface TaskStep {
  id: string;
  title: string; // "Generating 8 slides"
  state: TaskStepState;
  tool?: string; // "slides.create" tag
  detail?: string; // "drafting 'Growth & retention'…"
  progress?: number; // 0..1 for the running bar
}
export interface TaskRun {
  id: string;
  intent: string; // "Build a deck from the Q3 brief"
  steps: TaskStep[];
  usingMemory: boolean;
  toolCount: number;
  result?: { kind: string; previews: string[] }; // tiles: title/kpis/growth/next
  status: 'planning' | 'working' | 'review' | 'done' | 'stopped' | 'error';
}
```

**Memory** is a local store (e.g. a small SQLite table or JSON under `userData`), **not** in the
synced `config.json`. Define a `MemoryEntry` shape (`{ id, ts, kind, text, embedding? }`) in a
desktop service; keep it out of `ConfigSchema`. `ai.memoryEnabled` / `ai.tools` (Phase 1) gate it —
no new config fields required for the first cut.

## IPC channels

Streaming matters here — the surface updates per step. Two options:

```ts
// Promise-per-poll (simplest): start, then poll/get snapshots
taskRun: 'task:run',        // (intent) -> { taskId }
taskGet: 'task:get',        // (taskId) -> TaskRun
taskStop: 'task:stop',      // (taskId) -> { ok }

// OR streamed (preferred for live steps): main pushes updates
// add a `task:update` event via webContents.send, with a preload-registered
// listener (window.api.onTaskUpdate(cb)) — the one place a push channel is justified.
```

Decide based on Phase 1's streaming note. For live per-step UI, the **push** variant is worth it;
register the listener in preload (the only place `ipcRenderer.on` is allowed) and expose a typed
`onTaskUpdate` subscriber on `window.api`.

## Main-process work

- **Tool registry** — `services/agent/tools/registry.ts` with a mapped type so every declared tool id
  has an implementation (mirror the action-runner registry pattern). Tools take injected ports →
  unit-testable.
- **Tools (first set)** — `files.read` (reuse the file infra, read-only, path-scoped),
  `memory.recall` / `memory.write` (the local store). Each checks its `ai.tools` grant before running.
- **Memory service** — `services/agent/memory-service.ts`: append + recall (keyword first; embeddings
  later). Gated by `ai.memoryEnabled`.
- **Agent loop** — `services/agent/task-runner.ts`: given an intent, plan steps, execute tool calls,
  update `TaskRun` state, emit updates. With the **mock provider**, run a scripted plan (the Q3-deck
  sample) so the whole surface is demoable + testable offline. With a real provider, this is a
  bounded tool-use loop — consult the `claude-api` skill for the tool-use/agent pattern; cap
  iterations; require approval before side-effecting commits.
- `ipc/index.ts` — handle `taskRun` / `taskGet` / `taskStop` (+ the push channel if chosen).

## Renderer work

- **Organism `TaskSurface`** (mirrors `ai-task.html`): the intent in the search row; a status row
  ("Working · 3 of 5 steps") with a pulsing dot + a "Using memory · N tools" chip; the **step list**
  with markers — `m-done` (check, `--cz-success`), `m-run` (spinner, `--cz-accent`), `m-wait` (dot,
  `--cz-fg-faint`) — connected by a thin rail; per-step tool tag (mono chip) + detail; a running
  step shows the animated **progress bar** (`--cz-accent-grad`).
- **Result preview** — a row of tiles (the cross-hatched `.slide` placeholders) with labels; replace
  with real thumbnails when a tool produces them.
- **Actions** — ghost **Stop** (`taskStop`) + a primary "Open in …" (disabled until `status==='review'`
  /`'done'`, matching the mockup's 0.5-opacity primary).
- **Footer hints** — `space pause` / `↵ preview` / `esc dismiss`.
- **Subscription** — if streamed, subscribe via `window.api.onTaskUpdate`; else poll `taskGet` on an
  interval while `status` is active. Respect `prefers-reduced-motion` for the spinner/bar/pulse.
- **Entry point** — a launcher path to start a task (e.g. an AI-mode suggestion "Do this for me", or a
  task keyword). Reuse Phase 2's AI-mode plumbing where possible.

## Design reference (from `ai-task.html`)

- **Status:** pulsing 9px dot `--cz-accent` + `--cz-glow-chip`; "Working · 3 of 5 steps" 14px/600;
  memory chip `--cz-glass-2` pill with a history glyph in `--cz-accent`.
- **Markers:** 25px circles; done = `--cz-success` check; running = `--cz-accent-bright` refresh glyph
  on `--cz-accent-soft`; waiting = faint dot. Steps linked by a 1px `--cz-line` rail.
- **Tool tag:** mono, `--cz-glass-2` / `--cz-line`, `--cz-radius-xs` ("files.read", "memory.recall",
  "slides.create").
- **Progress bar:** 4px track `--cz-glass-2`, fill `--cz-accent-grad`, gentle width animation.
- **Result tiles:** 4/3 cross-hatch placeholders, mono caption.
- **Primary CTA disabled** at `opacity: .5` until the result is ready.
- **One accent moment:** the running step (marker + bar). Done/waiting stay neutral/green-check.
- **Voice:** terse status lines; "Review each slide before it's saved to your library." — keep the
  human-review promise explicit in copy.

## Acceptance criteria

- [ ] `taskRun('Build a deck from the Q3 brief')` runs the scripted plan via the mock provider and
      streams step states the surface renders (done/running/waiting + progress).
- [ ] Tools check their `ai.tools` grant and `ai.memoryEnabled` before running; a denied tool is
      skipped/blocked, not silently run.
- [ ] Memory write/recall works locally and is **off** when `ai.memoryEnabled` is false.
- [ ] Side-effecting results are **previewed for approval**; nothing commits to the library without
      it. **Stop** halts the run.
- [ ] No secrets or memory in the synced `config.json`; memory lives in `userData`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `apps/desktop/test/task-runner.test.ts`: inject mock provider + fake tools → assert the scripted
  plan produces the expected step-state sequence, respects grants/memory flag, and stops on `taskStop`.
- Tool registry: every declared tool id has an impl (mapped-type compile check, like the
  action-runner registry); each tool honors its grant.
- Memory service: append/recall; disabled when `memoryEnabled` is false.
- Manual parity pass on `ai-task.html`.

## Risks / open questions

- **Safety surface** — this phase can take real actions. Keep **explicit grants + human review**
  non-negotiable; default new tools to read-only; require approval before any external write.
- **Streaming transport** — settle the push-vs-poll IPC here (see Phase 1). Push gives the best live
  UX but is the one sanctioned `ipcRenderer.on` use — register it only in preload.
- **Real tool integrations** are large and external (Slides/Keynote/Slack APIs). Ship the loop +
  local tools first; add external tools incrementally, each its own slice.
- **Memory model** — start with simple keyword recall; add embeddings/semantic recall later. Keep the
  store local and private; cross-device sync is a separate backend effort.
- **Bounded autonomy** — cap loop iterations and tool calls; surface and stop on errors rather than
  spinning. "Fast by default" — the agent runs in the background and never blocks the instant bar.
