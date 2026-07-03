# CockpitZero — AI Cockpit roadmap (phased build plan)

> **✅ These seven phases are complete — and they built the AI Cockpit as _mocks_.** The path from
> mocks to **production** (real BYOP providers, a real local memory engine, real backend auth/sync,
> managed inference, real integrations — _no more mocks_) is planned in
> [`production/`](production/README.md). Start there for any new AI/memory/backend work.

This folder turns the eight screens of the **Roadmap** design (the _Sahara — warm minimalism_
language, from the CockpitZero Claude Design project) into an **executable, phased implementation
plan**. Each phase is a self-contained doc that one fresh chat can pick up and ship without needing
the others' conversation history.

> Companion to [`../ROADMAP.md`](../ROADMAP.md) (the narrative roadmap) and
> [`../ARCHITECTURE.md`](../ARCHITECTURE.md) (the layer breakdown). This folder is the _how_ and
> _in what order_. Read [`CLAUDE.md`](../../CLAUDE.md) at the repo root before starting any phase.

## The eight screens → phases

| #   | Screen(s)                             | Design tag   | Phase doc                                                          | Net-new surface                 |
| --- | ------------------------------------- | ------------ | ------------------------------------------------------------------ | ------------------------------- |
| —   | `launcher-searching` (shimmer search) | ✅ Shipped   | —                                                                  | already in code                 |
| 1   | _foundation — no screen_              | —            | [phase-1-ai-foundation.md](phase-1-ai-foundation.md)               | AI service + schema + IPC       |
| 2   | `ai-mode` + `ai-ask`                  | 🔜 Next      | [phase-2-ai-mode-and-ask.md](phase-2-ai-mode-and-ask.md)           | launcher AI mode + answer       |
| 3   | `cockpit-ai`                          | 🔜 Next      | [phase-3-cockpit-ai-settings.md](phase-3-cockpit-ai-settings.md)   | Console → AI tab                |
| 4   | `ai-workflow`                         | 🔜 Next      | [phase-4-ai-workflows.md](phase-4-ai-workflows.md)                 | launcher workflow-draft state   |
| 5   | `routine-digest`                      | 🔜 Next      | [phase-5-routines-digest.md](phase-5-routines-digest.md)           | routines engine + digest window |
| 6   | `yaml-config`                         | ⚙️ Config    | [phase-6-yaml-config-editor.md](phase-6-yaml-config-editor.md)     | YAML editor window              |
| 7   | `ai-task`                             | 🧭 Exploring | [phase-7-ai-task-memory-tools.md](phase-7-ai-task-memory-tools.md) | agent loop + task surface       |

Faithful HTML copies of every screen live in [`mockups/`](mockups/) — open them in a browser for
the pixel reference. The shipped "Searching" screen is reference-only and not re-implemented.

## Dependency graph

```
            ┌─────────────────────────────┐
            │ Phase 1 — AI foundation      │  AiService + AiProvider port (mock provider),
            │ (schema · IPC · service)     │  ai schema block, askAI/draftWorkflow channels
            └─────────────────────────────┘
              │           │            │
   ┌──────────┘     ┌─────┘            └─────────┐
   ▼                ▼                            ▼
┌──────────┐   ┌──────────┐               ┌──────────────┐
│ Phase 2  │   │ Phase 4  │               │ Phase 5      │
│ AI mode  │   │ AI-draft │               │ Routines +   │
│ + Ask AI │   │ workflow │               │ digest       │
└──────────┘   └──────────┘               └──────────────┘
   │                                            │
   ▼                                            │ (routines.yaml editing)
┌──────────┐                                    │
│ Phase 3  │  Console → AI tab persists the     │
│ Cockpit  │  ai block Phases 2/4/5/7 read.     │
│ AI       │  Best done right after Phase 2.    │
└──────────┘                                    │
                                                ▼
┌─────────────────────────┐            ┌──────────────────────┐
│ Phase 6 — YAML editor    │            │ Phase 7 — AI task    │
│ AI-INDEPENDENT.          │            │ memory + tools +     │
│ Needs only the config    │            │ agent loop. Capstone.│
│ (+ Routine) schema. Can  │            │ Needs P1; reads P3   │
│ run in PARALLEL anytime. │            │ tool/memory toggles. │
└─────────────────────────┘            └──────────────────────┘
```

**Hard prerequisites:** Phases 2, 4, 5, 7 each depend on **Phase 1**. Phase 3 is best sequenced
right after Phase 2 (it persists the settings those behaviors read, but they ship with sane
defaults so the order is soft). **Phase 6 is fully independent** of the AI work — it only needs the
config schema, plus the `RoutineSchema` from Phase 5 if you want to edit `routines.yaml`. It can be
built first, last, or in parallel by a second person.

### Suggested sequence

1. **Phase 1** — foundation (unblocks everything).
2. **Phase 2** — AI mode + Ask AI (first visible AI surface; proves the foundation).
3. **Phase 3** — Cockpit AI settings (makes Phase 2 user-configurable; sets up tool/memory toggles).
4. **Phase 4** — AI-drafted workflows (high value, isolated).
5. **Phase 5** — Routines + notification digest (largest; its own engine).
6. **Phase 7** — AI task: memory & tools (capstone; the agent layer).
7. **Phase 6** — YAML editor — schedule anytime; ideal as a parallel track since it shares no AI code.

## How to execute one phase in a fresh chat

Each phase doc is written to be dropped into a new conversation cold. A good kickoff prompt:

> Read `docs/roadmap/phase-<N>-<slug>.md` and `CLAUDE.md`, then implement that phase. The target
> screen mockup is `docs/roadmap/mockups/<screen>.html`. Follow the repo's existing patterns
> (shared Zod schema = source of truth, typed IPC bridge, layered main, atomic renderer). Add tests
> as the doc's test plan describes, and run `pnpm typecheck`, `pnpm lint`, `pnpm test` before
> finishing.

Every phase doc contains: **Goal**, **Prerequisites**, **Scope (in / out)**, **Data model & schema
changes**, **IPC channels**, **Main-process work**, **Renderer work**, **Design reference** (tokens,
copy, layout pulled from the mockup), **Acceptance criteria**, **Test plan**, and **Risks / open
questions**.

## Conventions that apply to every phase

These come from [`CLAUDE.md`](../../CLAUDE.md) and the design `readme.md`; restated so a phase chat
doesn't miss them:

- **Schemas are the source of truth.** New config shape goes into `packages/shared/src/schemas.ts`
  as Zod; types are `z.infer`'d in `types.ts`. Never hand-write a parallel type.
- **No raw IPC in components.** Renderer calls `window.api.*`; add channels via the four-step recipe
  (shared `ipc.ts` → main `ipc/index.ts` → preload `index.ts` → component). The contract test
  `apps/desktop/test/ipc-contract.test.ts` enforces parity.
- **OS / network access lives in `infra/` only**, reached through injected ports — keep services
  unit-testable and `electron`-free in tests.
- **Local-first & privacy-aware.** Anything leaving the machine is explicit, minimal, and behind a
  user toggle. The AI provider is pluggable; ship a **mock provider** so the whole stack is testable
  with no API key and no network.
- **Keyboard-first, always.** Every new surface is fully operable from the keyboard; render
  OS-correct key glyphs via the existing `Kbd` atom / `platform`.
- **Sahara visual language.** Warm-linen backdrop, warm-white panels, **one** burnt-sienna accent
  moment per view, EB Garamond serif headings over Manrope sans, ultra-soft warm shadows, no emoji,
  thin-line monochrome icons. Reuse the renderer's existing `--cz-*` tokens (see
  [`mockups/README.md`](mockups/README.md)); don't fork the token set.
- **Default to the latest Claude models** when wiring a real provider (see `claude-api` skill / the
  `cockpit-ai` mockup's Mini / Pro / Bring-your-own tiers).

## Distribution note

Per [`../ROADMAP.md`](../ROADMAP.md), the AI-era work is slated to ship in **private builds**. These
docs capture the plan; keep that in mind for anything that would be published openly.
