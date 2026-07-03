# Phase 4 — AI-drafted workflows

> **Status:** 🔜 Next · **Screen:** `mockups/ai-workflow.html` ·
> **Depends on:** [Phase 1](phase-1-ai-foundation.md) (AiService, `draftWorkflow` channel) + the
> **existing** workflow subsystem (`WorkflowSchema`, `WorkflowEditor`, `runWorkflow`).

Workflow authoring goes from manual wiring to a sentence. Describe an outcome — _"every morning,
open my three dashboards, start a focus timer, and drop today's standup notes into a new doc"_ — and
the AI **drafts an editable workflow**: it names it, suggests a keyword, and proposes typed steps you
can review, edit, and save into the normal workflow store.

## Goal

In a "describe a workflow" entry (launcher or Settings → Workflows → "Draft with AI"), type an
outcome → `draftWorkflow` returns a `WorkflowDraft` → render it as the mockup shows (serif name +
mono keyword + numbered, typed steps with edit affordances) → **Save workflow** materializes the
draft's actions and the `Workflow` into config via the existing path; **Discard** drops it.

## Scope

**In**

- `WorkflowDraft` shape in `packages/shared` (the real type Phase 1 stubbed).
- `draftWorkflow(description)` implemented in `AiService` (mock provider returns a deterministic,
  plausible 3–4 step draft; reuse the mockup's "Morning routine" as the canned sample).
- A draft **review** surface (organism) matching `ai-workflow.html`: name, keyword, step list with
  per-step kind badge + target + edit pencil, and the Discard / Save actions.
- **Save** = create any not-yet-existing step actions + the `Workflow`, then persist via `setConfig`
  (or a dedicated channel) and hand off to the existing `WorkflowEditor` for further edits.
- Per-step **edit** opens the existing action form for that step (reuse `ActionForm`).

**Out**

- Conditionals / branching / per-step arguments in execution — workflows remain sequential (CLAUDE.md
  says workflow execution is intentionally basic). The draft may _suggest_ arguments but execution
  stays L3.
- Auto-running the drafted workflow — drafting and saving only; running uses the existing
  `runWorkflow`.
- True tool-backed steps (e.g. "Post to Slack") actually posting — represented as `open-app`/snippet
  placeholders until Phase 7's tool layer. Mark such steps clearly.

## Data model & schema changes

`packages/shared` — a draft is a _proposed_ workflow plus its proposed step actions, not yet
persisted. Keep it a plain inferred type, not part of `ConfigSchema`:

```ts
export const WorkflowStepDraftSchema = z.object({
  /** Maps to an existing action id, or null when the step is a newly-proposed action. */
  actionId: z.string().nullable(),
  /** When actionId is null, the action to create on save. */
  action: ActionSchema.optional(),
  title: z.string(), // step title ("Open dashboards")
  target: z.string().optional(), // mono subtitle ("Datadog · Linear · Stripe")
  kindLabel: z.string(), // badge ("URL ×3", "Command", "Snippet", "App")
});

export const WorkflowDraftSchema = z.object({
  name: z.string(), // serif heading ("Morning routine")
  keyword: z.string(), // mono pill ("morning") → becomes an alias
  steps: z.array(WorkflowStepDraftSchema).min(1),
});
// type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>
```

On **Save**: for each step with `action` set, append it to `config.actions` (new id); build a
`Workflow` whose `steps` are the resolved action ids; optionally create an `Alias` from `keyword`.
All via the existing schemas — no new persisted shape.

## IPC channels

- Implement Phase 1's `draftWorkflow(description): Promise<WorkflowDraft>` in main.
- **Save** can reuse `setConfig` (append actions + workflow + alias, write the whole config) — no new
  channel needed. If you prefer an atomic server-side op, add `saveWorkflowDraft(draft)` via the
  four-step recipe, but `setConfig` is the lower-risk reuse.

## Main-process work

- `AiService.draftWorkflow` → provider. Mock provider parses the description loosely (or ignores it)
  and returns the canned 4-step draft so the flow is testable offline. The real provider prompts the
  model to emit a structured draft constrained to the four action kinds; **validate the model output
  with `WorkflowDraftSchema`** before returning (never trust raw model JSON).
- `ipc/index.ts` — handle `draftWorkflow`; if Save uses a dedicated channel, handle that too
  (resolve step actions → mutate config → persist → return the saved `Workflow`).

## Renderer work

- **Entry point.** Add a "Draft with AI" affordance in Settings → Workflows (next to "New workflow")
  and/or a launcher path (e.g. a `wf:` keyword or AI-mode suggestion). Simplest first: a button in
  `WorkflowEditor` that opens the draft input.
- **Organism `WorkflowDraftReview`** (mirrors `ai-workflow.html`): the AI tag ("Drafted workflow · N
  steps"), serif name + mono keyword pill, the numbered step list (number bubble, kind icon, title,
  mono target, kind badge, edit pencil), and the footer actions (ghost **Discard**, dark **Save
  workflow**).
- **Editing a step** reuses `ActionForm` (open it seeded with the step's proposed action). Saving the
  step updates the draft in place.
- **Save** calls the persist path, then transitions into the normal `WorkflowEditor` for the
  now-real workflow (so the user can keep tweaking). **Discard** clears the draft.
- Reuse `ResultIcon`/the kind glyphs for step icons; reuse `Badge` for kind labels.

## Design reference (from `ai-workflow.html`)

- **Input row:** spark icon + the description as 19px/1.4 text, `max-width: 56ch`.
- **Draft header:** AI tag uppercase `--cz-accent-bright` with a layers glyph; "Drafted workflow · 4
  steps".
- **Name block:** serif `h2` 28px `--cz-fg`; keyword `kw` in mono inside a `--cz-glass-2` pill with
  `--cz-line-strong` border, `--cz-radius-xs`.
- **Step row:** 24px number bubble (`--cz-glass-2`, mono 12px), 36px kind icon chip, title 15px/500,
  mono target 13px `--cz-fg-subtle` (truncates), kind badge uppercase, 30px edit pencil
  `--cz-fg-faint`; rows divided by `--cz-line-faint`.
- **Actions:** hint "AI drafted · review and edit any step" with spark; **Discard** ghost
  (`--cz-line-strong` border); **Save workflow** dark primary (`#3a302a` fill, `#fffaf3` text,
  `--cz-shadow-md`, save glyph).
- **Footer hints:** `⌘S save` / `tab next step` / `esc discard`.
- **Copy/voice:** terse; the four kinds map to existing badges URL / COMMAND / SNIPPET / APP. Keep
  `{date}` token style consistent with L2 argument syntax (`{token}` in curly braces).

## Acceptance criteria

- [ ] A description → `draftWorkflow` → a rendered, editable draft matching the mockup's structure.
- [ ] Each step shows the correct kind icon + badge; targets render in mono and truncate gracefully.
- [ ] Editing a step opens `ActionForm` and reflects changes back into the draft.
- [ ] **Save** creates the needed actions + the workflow (+ optional alias) in config and lands in the
      normal `WorkflowEditor`; the workflow then runs via existing `runWorkflow`.
- [ ] **Discard** removes the draft with no config change.
- [ ] Model/mock output is validated by `WorkflowDraftSchema` before rendering.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `packages/shared`: `WorkflowDraftSchema` parse/reject cases; the draft→config materialization
  (draft → `{actions, workflow, alias}`) as a pure function with unit tests.
- `apps/desktop/test/ai-service.test.ts` (extend): `draftWorkflow` returns a schema-valid draft from
  the mock; invalid provider output is rejected.
- Manual parity pass on `ai-workflow.html` for the review surface.

## Risks / open questions

- **Trusting model output** — always validate against `WorkflowDraftSchema`; coerce/repair or
  re-prompt on failure. Never persist unvalidated steps.
- **Steps that need Phase 7 tools** (Slack post, doc create) — represent as the closest existing kind
  (`open-app`, `snippet`) with a clear target; upgrade them when the tool layer exists.
- **Keyword/alias collisions** — on Save, dedupe the proposed `keyword` against existing aliases.
- **Entry-point UX** — keep the first version simple (a Settings button); a launcher trigger keyword
  can follow once the surface is proven.
