# CockpitZero — Roadmap

Where CockpitZero is headed. Today it's a fast, keyboard-first launcher (open URLs/apps, run
commands, paste snippets, parameterized actions, workflows, and cross-platform app/file search).
The next chapters turn it from a **launcher** into an **AI cockpit** — a single bar from which you
delegate real work, not just trigger commands.

> **Heads-up on distribution.** CockpitZero has been developed in the open up to this point.
> **Future releases will be private.** This repository and these docs capture the foundation;
> the AI-era work described below ships in private builds.

---

## Where we are today (shipped)

These are implemented and live in the current codebase — see the [README](../README.md) for the
full breakdown.

- **Actions** — open URLs, open apps, run shell commands, copy/paste snippets.
- **Parameterized actions (L2)** — `{token}` templates with positional, live-previewed arguments.
- **Workflows (L3)** — chain actions and run them in sequence.
- **System search (L4)** — installed apps + files via Spotlight/`mdfind` (macOS) and the Search
  index (Windows), merged into sectioned results.
- **fzf fuzzy ranking** with match highlighting, frecency (frequency × recency) boosting, native
  app/file icons, and favicons for URL actions.
- **GUI config** — actions, aliases, workflows, hotkey, theme, and frosted-glass appearance, all
  editable in a settings window; an optional backend syncs config across devices.

---

## Where we're going (the AI cockpit)

### 1. AI integration — a model behind the bar

The launcher gains a first-class AI surface. Instead of only matching what you've configured, you
can **ask** the bar in natural language and let it figure out the rest. This is the backbone every
feature below builds on.

### 2. Ask AI to build your workflows

Today you assemble workflows by hand in Settings. Next, you describe the outcome —
_"every morning, open my three dashboards, start a focus timer, and drop today's standup notes into
a new doc"_ — and the AI **drafts the workflow for you**: it picks the actions, wires up the
arguments, and hands you an editable result. Workflow authoring goes from manual wiring to a
conversation.

### 3. Routines — proactive, prioritized assistance

Routines are AI-driven jobs you set up once and that run on their own. The first flagship routine:

- **A unified notification digest.** CockpitZero pulls messages and notifications across your tools
  (email, Slack, Teams, …), then **summarizes and prioritizes** them by importance — so instead of
  scanning five inboxes, you get one ranked briefing: what actually needs you now, what can wait,
  what's noise.

Routines are the bridge from "I summon the launcher" to "the launcher comes to me."

### 4. A much more efficient UI

As the bar takes on richer work — summaries, drafts, multi-step results — the interface evolves to
present that information densely and glanceably, while staying keyboard-first and out of your way.
Speed and zero-friction remain the north star.

### 5. Memory, history & tools — an assistant that does the work

CockpitZero gains **persistent memory/history** and a **tool layer** the AI can call, so it can
carry context across sessions and actually _act_ on your behalf. The goal is to absorb the daily
busywork. For example, a project manager could:

- **Summarize a meeting** into notes and action items.
- **Create a presentation** (slides) from a brief or a transcript.
- **Fill in a spreadsheet** — populate, compute, and format data.
- …and more, as the tool catalog grows.

The pattern: you state the intent, the AI uses its tools, memory, and your history to complete the
task, and you review the result.

---

## Guiding principles

- **Keyboard-first, always.** Every new capability is reachable without leaving the keyboard.
- **Fast by default.** AI features never block the instant, local launcher experience — the bar
  stays responsive while heavier work happens in the background.
- **Local-first, privacy-aware.** Config and usage stay on-device; anything that leaves the machine
  is explicit and minimal.
- **The schemas lead.** New capabilities extend the shared Zod schemas and the layered architecture
  rather than bolting on side-channels.

---

## Status legend

| Stage          | Meaning                                            |
| -------------- | -------------------------------------------------- |
| ✅ Shipped     | In the current codebase.                           |
| 🔜 Next        | Actively designed; foundation already in place.    |
| 🧭 Exploring   | Direction set; details being worked out.           |

| Capability                            | Stage         |
| ------------------------------------- | ------------- |
| Actions / aliases / parameterized (L1–L2) | ✅ Shipped |
| Workflows (L3)                        | ✅ Shipped     |
| System app + file search (L4)         | ✅ Shipped     |
| Frecency ranking, icons, favicons     | ✅ Shipped     |
| AI behind the bar                     | 🔜 Next        |
| AI-authored workflows                 | 🔜 Next        |
| Routines (notification digest)        | 🔜 Next        |
| Memory / history / tools              | 🧭 Exploring   |
| Task automation (summaries, slides, sheets) | 🧭 Exploring |
| Efficiency-focused UI overhaul        | 🧭 Exploring   |

---

_This roadmap is intentionally directional, not a dated commitment. Future builds are private._
