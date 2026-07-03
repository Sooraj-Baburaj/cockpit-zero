import type { z } from 'zod';
import type {
  ActionSchema,
  AliasSchema,
  ArgumentSchema,
  WorkflowSchema,
  WorkflowStepDraftSchema,
  WorkflowDraftSchema,
  SettingsSchema,
  ConfigSchema,
  AiSettingsSchema,
  AiProviderIdSchema,
  AiModelTierSchema,
  AiToolIdSchema,
  RoutineSchema,
  RoutineSourceIdSchema,
  RoutineRankBySchema,
  RoutineSummarizeSchema,
} from './schemas.js';

/** All domain types are inferred from the Zod schemas (the source of truth). */
export type Action = z.infer<typeof ActionSchema>;
export type ActionKind = Action['type'];
export type Argument = z.infer<typeof ArgumentSchema>;
export type Alias = z.infer<typeof AliasSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowStepDraft = z.infer<typeof WorkflowStepDraftSchema>;
export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/** AI config types — inferred from the schemas (never hand-written). */
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type AiProviderId = z.infer<typeof AiProviderIdSchema>;
export type AiModelTier = z.infer<typeof AiModelTierSchema>;
export type AiToolId = z.infer<typeof AiToolIdSchema>;

/** Routine config types — inferred from the schemas (Phase 5). */
export type Routine = z.infer<typeof RoutineSchema>;
export type RoutineSourceId = z.infer<typeof RoutineSourceIdSchema>;
export type RoutineRankBy = z.infer<typeof RoutineRankBySchema>;
export type RoutineSummarize = z.infer<typeof RoutineSummarizeSchema>;

/**
 * The runtime types a routine's digest produces (Phase 5). These are NOT
 * persisted config — they're computed each run by the digest runner and rendered
 * by the briefing surface (mirrors `routine-digest.html`).
 */

/** Which bucket a digest item lands in after AI summarize + rank. */
export type DigestBucket = 'now' | 'wait' | 'noise';

/** One ranked, summarized notification in a digest. */
export interface DigestItem {
  id: string;
  /** Who/what it's from, e.g. "Priya Shah". */
  who: string;
  /** Source badge, e.g. "Slack". */
  source: RoutineSourceId;
  /** One-line AI summary. */
  summary: string;
  /** Relative time, e.g. "12m". */
  when: string;
  bucket: DigestBucket;
  /** Rank score; higher surfaces first within a group. */
  score: number;
  /** Deep link / app path when the item is openable (`↵ open`). */
  openPath?: string;
}

/** A computed digest — what the briefing surface renders. */
export interface Digest {
  routineId: string;
  /** Serif heading, e.g. "Morning briefing". */
  title: string;
  /** Formatted clock time of the run, e.g. "8:42 AM". */
  updatedAt: string;
  /** How many sources were pulled. */
  sourceCount: number;
  /** Surfaced (now + wait) vs total items collected ("20 of 41 surfaced"). */
  surfaced: number;
  total: number;
  groups: { now: DigestItem[]; wait: DigestItem[]; noiseCount: number };
}

/**
 * The minimal, privacy-conscious payload handed to the AI summarize/rank step —
 * just enough text to summarize and bucket, no raw provider objects. The model
 * (or the deterministic local ranker) returns one `DigestRanking` per item.
 */
export interface DigestSourceItem {
  id: string;
  who: string;
  source: RoutineSourceId;
  /** Raw notification text to summarize. */
  text: string;
  /** Age in minutes (for recency ranking). */
  ageMinutes: number;
}

/** The AI summarize/rank step's per-item output. */
export interface DigestRanking {
  id: string;
  /** One-line summary the row renders. */
  summary: string;
  bucket: DigestBucket;
  score: number;
}

/** Knobs handed to the summarize/rank step. */
export interface DigestSummarizeOptions {
  rankBy: RoutineRankBy;
  modelTier: AiModelTier;
  maxItems: number;
}

/**
 * A single row in the launcher — generalized beyond config actions so the bar
 * can also surface installed applications and files (system search, Level 4). A
 * discriminated union on `kind`; `id` is stable per result and `matches` are
 * highlight ranges over `title`.
 */
export type LauncherItemKind = 'action' | 'workflow' | 'app' | 'file';

interface LauncherItemBase {
  /** Stable id: action/workflow id, or absolute path for app/file. */
  id: string;
  /** Primary display text. */
  title: string;
  /** Secondary line (e.g. an app/file's path). */
  subtitle?: string;
  /** Relative match score; higher is better. */
  score: number;
  /** Index ranges in `title` that should be highlighted. */
  matches: Array<[number, number]>;
}

/** A configured action (Level 1/2). */
export interface ActionItem extends LauncherItemBase {
  kind: 'action';
  action: Action;
}
/** A configured workflow (Level 3). */
export interface WorkflowItem extends LauncherItemBase {
  kind: 'workflow';
  workflow: Workflow;
}
/** An installed application discovered by system search (Level 4). */
export interface AppItem extends LauncherItemBase {
  kind: 'app';
  /** Absolute path to the .app bundle / .lnk / executable. */
  path: string;
}
/** A file discovered by system search (Level 4). */
export interface FileItem extends LauncherItemBase {
  kind: 'file';
  /** Absolute path to the file. */
  path: string;
}

/** Any launcher result row. Run it by switching on `kind` (see LauncherBar). */
export type LauncherItem = ActionItem | WorkflowItem | AppItem | FileItem;

/**
 * The outcome of interpreting raw launcher input (see `resolveQuery`).
 * Either a ranked result list, or — when the leading token is the keyword of a
 * parameterized action — an "argument capture" state the bar renders specially.
 */
export type ResolvedQuery =
  | { kind: 'results'; results: LauncherItem[] }
  | {
      kind: 'argument';
      action: Action;
      /** The matched alias keyword (rendered as a chip). */
      keyword: string;
      /** Live values for the action's parameters, in declaration order. */
      values: string[];
      /** Index of the parameter currently being typed (for caret/highlight). */
      activeIndex: number;
    };

/**
 * One AI-proposed action the launcher can offer to run (Phase 2's "Suggested
 * actions"). Display-only by default; when `action` is present the surface can
 * materialize/run it through the normal action runner.
 */
export interface AiSuggestedAction {
  /** A real action id when it maps to config, else a synthetic preview id. */
  id: string;
  title: string;
  subtitle?: string;
  /** Badge text in the mockup: "Draft" / "App" / "Task". */
  badge?: string;
  /** Optional inline action to materialize/run; absent = display-only suggestion. */
  action?: Action;
}

/** The wire shape `askAI` resolves to: a prose answer + proposed actions. */
export interface AiAnswer {
  /** The prose answer body (markdown-lite; bold supported). */
  text: string;
  /** Provenance line, e.g. "cockpit-ai · 0.6s · 31 messages read". */
  meta?: string;
  suggestions: AiSuggestedAction[];
}

/**
 * One event in a streamed `askAIStream` response (production phase 4). The main
 * process pushes these over `AI_STREAM_CHANNEL` as tokens arrive: `delta` carries
 * an incremental chunk of prose, `done` carries the finalized {@link AiAnswer}
 * (full text + usage `meta` + suggestions), and `error` a human-readable failure.
 * A user-initiated cancel emits **nothing** — the stream simply stops. Token-grained
 * sibling of the task surface's `TaskRun` snapshots.
 */
export type AiStreamEvent =
  | { streamId: string; type: 'delta'; text: string }
  | { streamId: string; type: 'done'; answer: AiAnswer }
  | { streamId: string; type: 'error'; message: string };

/**
 * A remembered fact as it crosses IPC to the Console memory view (the local memory
 * engine, production phase 5). The vector `embedding` is deliberately **omitted** —
 * it's large and main-process-only; the renderer only needs the readable record.
 * The desktop `MemoryEntry` (services/agent/memory-service) extends this with the
 * embedding used for on-device recall. Memory is local + private and NEVER synced
 * config, so this lives here only as the wire shape, not in `ConfigSchema`.
 */
export interface MemoryRecord {
  id: string;
  /** Epoch ms it was first written. */
  ts: number;
  /** Epoch ms it was last updated — a dedup/merge bumps this; the recall recency
   *  boost and decay/prune read it. */
  updatedAt: number;
  /** Coarse category, e.g. "fact" / "preference" / "task" / "event" / "note". */
  kind: string;
  text: string;
  /** Salience in [0,1] — biases recall ranking and the optional decay/prune. */
  importance: number;
  /** Provenance, e.g. "ask" / "task" / "import". */
  source?: string;
}

/** Aggregate stats for the Console memory header (production phase 5). */
export interface MemoryStats {
  count: number;
  /** Epoch ms of the most-recently-updated entry, or null when the store is empty. */
  updatedAt: number | null;
  /** The active embedding source label ("local" / "provider"). */
  embeddingSource: string;
}

/**
 * Runtime task/agent shapes (Phase 7). These are NOT persisted config — a
 * `taskRun` is computed by the main-process agent loop (`services/agent/task-runner`)
 * and streamed to the task surface (`ai-task.html`). The renderer renders one
 * `TaskRun` at a time; main pushes a fresh snapshot on every step transition.
 */

/**
 * A step's marker state. `done`/`running`/`waiting` mirror the three mockup
 * markers; `blocked` is the honest fourth — a tool the run wanted to call but
 * couldn't, because its `ai.tools` grant (or `ai.memoryEnabled`) is off. A
 * blocked step is never silently run (acceptance criterion).
 */
export type TaskStepState = 'done' | 'running' | 'waiting' | 'blocked';

/** One row in the task checklist. */
export interface TaskStep {
  id: string;
  /** Step title, e.g. "Generating 8 slides". */
  title: string;
  state: TaskStepState;
  /** Tool tag rendered as a mono chip, e.g. "files.read" / "slides.create". */
  tool?: string;
  /** The model-chosen tool input, compacted to one mono line (e.g.
   *  `path: ~/Documents/q3-brief.pdf`) — the real per-step arguments (production
   *  phase 6), shown so an autonomous tool call is never opaque. */
  args?: string;
  /** Sub-line under the title, e.g. "drafting 'Growth & retention'…". */
  detail?: string;
  /** Whether this step's tool is a not-yet-real external **stub** (a labeled
   *  placeholder until its real connector lands in P10) — the surface badges it so
   *  stub output is never mistaken for a real side effect. */
  stub?: boolean;
  /** 0..1 fill for the running step's progress bar. */
  progress?: number;
}

/** Where a `TaskRun` is in its lifecycle. `review` is the human-in-the-loop
 *  pause: a side-effecting result is ready but nothing has been committed yet. */
export type TaskStatus = 'planning' | 'working' | 'review' | 'done' | 'stopped' | 'error';

/** The reviewable artifact a task produces — preview tiles now, real thumbnails
 *  later. Shown before anything is committed to the user's library. */
export interface TaskResult {
  /** What was produced, e.g. "slides". */
  kind: string;
  /** Tile captions (the cross-hatch placeholders): title / kpis / growth / next. */
  previews: string[];
  /** The primary CTA label once ready, e.g. "Open in Keynote". */
  openLabel?: string;
}

/** A single agent run: an intent → planned steps → a reviewable result. */
export interface TaskRun {
  id: string;
  /** The stated intent, e.g. "Build a deck from the Q3 brief". */
  intent: string;
  steps: TaskStep[];
  /** Whether this run reads/writes memory (drives the "Using memory" chip). */
  usingMemory: boolean;
  /** Distinct non-memory tools the run uses (the "· N tools" count). */
  toolCount: number;
  result?: TaskResult;
  status: TaskStatus;
  /** The model's closing summary of what it did (production phase 6) — one or two
   *  sentences, or a "reached the limit" note when a bound stopped the loop. */
  summary?: string;
  /** A human hint when `status` is `error` (e.g. "Enable Slides & Sheets…"). */
  note?: string;
}
