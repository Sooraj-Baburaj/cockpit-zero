import type { AgentToolId } from '@cockpitzero/shared';

/**
 * The task planner (Phase 7) — turns an intent into an ordered plan of steps the
 * runner executes. This is the task analogue of an AI provider's output: the
 * **mock** planner is offline + deterministic (it returns the scripted Q3-deck
 * sample regardless of intent, so the whole task surface is demoable + testable
 * without the network), exactly as the mock AI provider ignores its prompt and
 * returns canned copy. A real planner (a bounded Claude tool-use loop) is a later
 * seam — consult the `claude-api` skill; cap iterations; keep the review gate.
 */

/** One planned step. A step with no `tool` is something the agent does itself
 *  (e.g. apply a theme); `review: true` marks the human-in-the-loop checkpoint —
 *  the run pauses for approval *after* this step, before the committing steps. */
export interface PlannedStep {
  title: string;
  tool?: AgentToolId;
  /** Input passed to the tool's `run` (tool-specific shape). */
  input?: unknown;
  /** Canned narration shown under the step (a tool may override it with a real
   *  signal, e.g. memory.recall's match count). */
  detail?: string;
  /** After this step, enter `review`: the result is ready but uncommitted. */
  review?: boolean;
}

/** A planner: intent → plan. Injected into the runner (like `summarize` is into
 *  the digest runner), so production can swap mock → real without touching it. */
export type TaskPlanner = (intent: string) => PlannedStep[];

/**
 * The scripted "Build a deck from the Q3 brief" plan (mirrors `ai-task.html`):
 * read the brief, recall prior context, generate the slides (the reviewable
 * result), then — after approval — theme + export (the committing steps).
 */
const Q3_DECK: PlannedStep[] = [
  {
    title: 'Read q3-brief.pdf',
    tool: 'files.read',
    input: { path: '~/Documents/q3-brief.pdf' },
    detail: '14 pages · 6 KPIs extracted',
  },
  {
    title: "Pull revenue numbers from last week's standup",
    tool: 'memory.recall',
    input: { query: 'revenue standup q3 deck' },
  },
  {
    title: 'Generate 8 slides',
    tool: 'slides.create',
    input: { count: 8, previews: ['title', 'kpis', 'growth', 'next'] },
    detail: 'drafting “Growth & retention”…',
    review: true,
  },
  { title: 'Apply Sahara theme' },
  { title: 'Export to Keynote' },
];

/** Deep-copy the canned plan so a run never mutates the shared template. */
function clone(plan: PlannedStep[]): PlannedStep[] {
  return plan.map((s) => ({ ...s }));
}

/** The offline, deterministic planner — the dev + test default. */
export function createMockPlanner(): TaskPlanner {
  return () => clone(Q3_DECK);
}
