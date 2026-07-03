# Production Phase 6 — Real agent loop (AI-SDK tool-use)

> **Status:** 🔜 Next · **Depends on:** P3 (provider), P5 (real memory tools) · **Blocks:** nothing
> (P10 later upgrades external tools). **Risk:** high — autonomous tool execution + the review gate.

The v1 task planner is a **scripted mock** (`createMockPlanner` returns a canned Q3-deck plan,
ignoring intent). Replace it with a **real bounded agent loop** using the Vercel AI SDK's tool-calling
(`generateText`/`streamText` with `tools` + `stopWhen`/`maxSteps`). Keep the existing safety design:
grant-enforced tools, the **review→approve human gate** before committing side effects, and `stop`.

## Goal

`taskRun(intent)` runs a real model-driven plan: the model selects tools, the runner executes only
**granted** tools, streams step snapshots over the existing `task:update` channel, **pauses for human
approval** before any committing/side-effecting step, and can be stopped. No scripted plan.

## Locked decisions honored

- AI SDK tool-calling as the loop engine (don't hand-roll the ReAct loop).
- Tools execute in `infra/` behind injected ports; grant enforcement unchanged.
- Local tools real now (`files.read`, `memory.recall`/`memory.write` via P5). External
  tools (slack/calendar/slides) get **real** connectors in **P10** — until then they remain explicit
  local stubs that are clearly labeled and **off by default** (the only allowed mock, and it must look
  like a stub, not real output).

## Scope

**In**

- `services/agent/planner.ts` → replace `createMockPlanner` with `createAgentLoop` driven by the AI
  SDK: define tools with Zod parameter schemas, run with a hard `maxSteps`/iteration cap, map tool
  calls to the existing `tools/registry.ts`.
- Preserve `task-runner.ts` semantics: stream `TaskRun`/`TaskStep` snapshots via the injected `emit`;
  enforce grants (`isToolAllowed`) → `blocked`; **review** state before committing steps; `approve`;
  `stop` (now also aborts the model via AbortController).
- A clear separation of **read/safe** tools (auto-run) vs **committing/side-effecting** tools (require
  approval): the runner enters `review` before the first committing tool, exactly as today.
- Real `files.read` (already real), `memory.recall`/`memory.write` (now backed by P5's engine).
- Bounded cost: cap steps, cap tokens, cap tool calls; surface usage in the task meta.

**Out**

- Real Slack/calendar/slides/sheets tool _connectors_ (P10). Keep them as labeled local stubs that are
  grant-gated and off by default; do not present stub output as real.
- Multi-agent / sub-agents. Single bounded loop only.

## Data model & schema changes

- `AgentToolId` / `AgentToolGrant` (in `shared/task.ts`) stay; you may add tool ids as real connectors
  land (P10). No config-shape change required here.
- Optionally add `maxSteps` / `maxToolCalls` to the `ai` block (additive defaults) for power users.

## IPC channels

None new — `taskRun`/`taskGet`/`taskStop`/`taskApprove` + `onTaskUpdate` already exist (v1 Phase 7).
`taskStop` must now also abort the in-flight model request.

## Main-process work

- `createAgentLoop({ provider, tools, memory, maxSteps })`:
  - Build the AI SDK `tools` map from `tools/registry.ts` (each tool: description + Zod params +
    `execute` that calls the registry handler **only if granted**, else throws → runner marks
    `blocked`).
  - Run `streamText({ model, tools, stopWhen: stepCountIs(maxSteps), messages })`; on each tool call,
    emit a `TaskStep` snapshot; intercept **committing** tools to require the review gate (don't let
    the model auto-execute a side effect — gate it through the runner, not inside the tool).
  - Inject P5 memory: seed the loop with relevant recalled context; write salient results back.
- `task-runner.ts`: adapt to consume the loop's events instead of the scripted `PlannedStep[]`; keep
  `review`/`approve`/`blocked`/`stop` exactly. `stop` aborts via AbortController.
- Keep the planner **injectable** so tests use a fake loop (deterministic tool sequence) and the mock
  AI provider keeps the surface demoable in CI.

## Renderer work

- Minimal. `TaskSurface`/`TaskScreen` already render streamed snapshots, the review gate, approve/stop.
  Add: a real "model is choosing a tool…" affordance, real per-step tool args/results, and a clear
  **"stub" badge** on any not-yet-real external tool so users aren't misled.

## Acceptance criteria

- [ ] `taskRun` produces a **model-chosen** plan (varies with intent), not the canned Q3 deck.
- [ ] Only **granted** tools execute; an ungranted tool call yields a `blocked` step (not a silent run).
- [ ] The run **pauses at `review`** before any committing/side-effecting step and only proceeds on
      `approve`; `stop` halts the loop **and** aborts the model request.
- [ ] `files.read`, `memory.recall`, `memory.write` are **real** (P5-backed); external tools are
      visibly labeled stubs, off by default.
- [ ] Step/token/tool-call caps are enforced; the loop can't run unbounded.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green (fake loop / mock provider in tests).

## Test plan

- `test/task-runner.test.ts` — rewrite around a **fake agent loop** emitting a deterministic tool
  sequence: assert grant enforcement→`blocked`, the review→approve gate before committing steps,
  `stop`/abort, and cap enforcement. Electron-free.
- `test/tool-registry.test.ts` — keep the exhaustive-handler invariant; add the new real tool wiring.
- An integration-style test (behind a flag) with the mock provider to prove the loop wiring.

## Risks / open questions

- **Autonomy safety.** Never let the model execute a committing tool without the human gate — enforce
  in the runner, not by trusting the model. Read tools auto-run; writes/sends require approval.
- **Loop termination.** Hard `maxSteps` + token/tool caps + timeouts; on hitting a cap, end in a clear
  state, not a hang.
- **Stub honesty.** Until P10, external-tool output is a stub — it MUST be labeled as such (no
  pretending a Keynote was exported). This is the one place a non-test stub survives, and only because
  it's clearly marked and grant-gated off by default.
- **Per-provider tool-calling differences.** The AI SDK normalizes tool-calling, but coverage varies;
  test with at least two providers.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-6-real-agent-loop.md` and `CLAUDE.md`, then replace the scripted
> mock planner with a **real bounded agent loop** using the Vercel AI SDK tool-calling
> (`streamText` + `tools` + a hard `maxSteps`/token/tool cap). Build tools from `tools/registry.ts`
> with Zod params; execute only **granted** tools (ungranted ⇒ `blocked`). Preserve the existing
> `task:update` streaming, the **review→approve** human gate before committing steps, and `stop`
> (now also aborts the model). Make `files.read` + `memory.recall`/`memory.write` real (P5-backed);
> keep external tools (slack/calendar/slides) as clearly-labeled, grant-gated, off-by-default stubs
> until P10 — never present stub output as real. Test with a fake loop (no network); run
> `pnpm typecheck`, `pnpm lint`, `pnpm test`.
