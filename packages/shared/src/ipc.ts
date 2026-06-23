import type {
  AiAnswer,
  AiStreamEvent,
  Config,
  Digest,
  LauncherItem,
  MemoryRecord,
  MemoryStats,
  ResolvedQuery,
  Routine,
  TaskRun,
  WorkflowDraft,
} from './types.js';

/**
 * IPC channel names — the contract between the desktop main process and the
 * renderer. Both `src/main/ipc/*` and `src/preload/index.ts` import these
 * constants so a channel can never be misspelled on one side.
 *
 * To add a channel: add it here, add a payload type to `IpcApi` below, add an
 * `ipcMain.handle` in main, and expose it on the preload bridge. See CLAUDE.md.
 */
export const IpcChannels = {
  getConfig: 'config:get',
  setConfig: 'config:set',
  resolveQuery: 'launcher:resolve-query',
  searchSystem: 'launcher:search-system',
  runAction: 'launcher:run-action',
  runWorkflow: 'launcher:run-workflow',
  openPath: 'launcher:open-path',
  getFileIcon: 'system:get-file-icon',
  getFavicon: 'system:get-favicon',
  completePath: 'system:complete-path',
  askAI: 'ai:ask',
  askAIStream: 'ai:ask-stream',
  cancelAiStream: 'ai:ask-cancel',
  draftWorkflow: 'ai:draft-workflow',
  aiStatus: 'ai:status',
  runRoutine: 'routine:run',
  getDigest: 'routine:get-digest',
  listRoutines: 'routine:list',
  taskRun: 'task:run',
  taskGet: 'task:get',
  taskStop: 'task:stop',
  taskApprove: 'task:approve',
  memoryStats: 'memory:stats',
  memorySearch: 'memory:search',
  memoryForget: 'memory:forget',
  memoryClear: 'memory:clear',
  setSecret: 'secret:set',
  clearSecret: 'secret:clear',
  secretStatus: 'secret:status',
  openConsole: 'window:open-console',
  hideLauncher: 'window:hide-launcher',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

/**
 * The one **push** channel (main → renderer), separate from the request/response
 * `IpcChannels` above because it's a `webContents.send` / `ipcRenderer.on` pair,
 * not an `invoke`/`handle`. The task surface subscribes to it for live per-step
 * updates; preload is the only place `ipcRenderer.on` is allowed (CLAUDE.md), so
 * `onTaskUpdate` registers the listener there.
 */
export const TASK_UPDATE_CHANNEL = 'task:update';

/**
 * The AI streaming push channel (main → renderer), the second `webContents.send` /
 * `ipcRenderer.on` pair after {@link TASK_UPDATE_CHANNEL}. `askAIStream` kicks off a
 * provider stream and the main process pushes `AiStreamEvent`s here as tokens land;
 * the renderer subscribes with `onAiStream` (registered in preload — the only place
 * `ipcRenderer.on` is allowed, CLAUDE.md). It is **not** in `IpcChannels` because
 * it's a push, not an `invoke`/`handle`.
 */
export const AI_STREAM_CHANNEL = 'ai:stream';

/**
 * The typed surface exposed to the renderer as `window.api`. Each method maps
 * to one channel. Keep this in sync with the preload bridge — the renderer is
 * typed entirely from this interface.
 */
export interface IpcApi {
  getConfig(): Promise<Config>;
  setConfig(config: Config): Promise<Config>;
  /** Interpret raw input → ranked **config** results or an argument-capture state
   *  (L2). Returns instantly; system (app/file) results come from `searchSystem`. */
  resolveQuery(input: string): Promise<ResolvedQuery>;
  /** System-search results (installed apps + files) for a plain query. Split from
   *  `resolveQuery` so the slow OS index never delays the instant config matches. */
  searchSystem(input: string): Promise<LauncherItem[]>;
  /** Run an action; `values` fill the action's `{token}`s positionally (L2). */
  runAction(actionId: string, values?: string[]): Promise<{ ok: boolean; error?: string }>;
  /** Run a workflow's steps in sequence (Level 3). */
  runWorkflow(workflowId: string): Promise<{ ok: boolean; error?: string }>;
  /** Open a file or application by absolute path (system-search results). */
  openPath(path: string): Promise<{ ok: boolean; error?: string }>;
  /** Native icon for an app/file path as a data URL, or null if unavailable. */
  getFileIcon(path: string): Promise<string | null>;
  /** Favicon for an http(s) URL as a data URL, or null if unavailable. */
  getFavicon(url: string): Promise<string | null>;
  /** Filesystem path suggestions for a partial absolute path (autocomplete). */
  completePath(input: string): Promise<string[]>;
  /** Ask the assistant a free-text question; resolves to an answer + suggested
   *  actions. Promise-based (resolve-once) — kept as the compat/single-value path
   *  alongside the streamed `askAIStream` (P4). */
  askAI(prompt: string): Promise<AiAnswer>;
  /** Start a **streamed** answer (production phase 4). Resolves with the `streamId`
   *  immediately; prose arrives token-by-token via `onAiStream` (`delta`), then a
   *  final `done` carries the full `AiAnswer` (+ suggestions). */
  askAIStream(prompt: string): Promise<{ streamId: string }>;
  /** Abort an in-flight streamed answer (Escape / closing the bar). Cancels the
   *  underlying provider request; no further `onAiStream` events fire for it. */
  cancelAiStream(streamId: string): Promise<void>;
  /** Draft a workflow from a natural-language description. Stub here; Phase 4
   *  implements the real drafting. */
  draftWorkflow(description: string): Promise<WorkflowDraft>;
  /** Whether AI is enabled + reachable, for surfaces that show connected state. */
  aiStatus(): Promise<{ enabled: boolean; provider: string; ok: boolean }>;
  /** Run a routine now (Phase 5): fan out to its sources, summarize + rank, and
   *  deliver. Resolves to the freshly computed digest (also stored for `getDigest`). */
  runRoutine(routineId: string): Promise<Digest>;
  /** The last-computed digest for a routine, or null if it hasn't run this session. */
  getDigest(routineId: string): Promise<Digest | null>;
  /** The configured routines (for the Console → Routines list). */
  listRoutines(): Promise<Routine[]>;
  /** Start an agent task from an intent (Phase 7). Returns the run id; progress
   *  streams via `onTaskUpdate` and the task window opens to show it. */
  taskRun(intent: string): Promise<{ taskId: string }>;
  /** The latest snapshot of a run (the surface fetches this on mount, then
   *  streams the rest via `onTaskUpdate`). Null if the id is unknown. */
  taskGet(taskId: string): Promise<TaskRun | null>;
  /** Halt a run — sets it to `stopped` (also resolves a `review` pause). */
  taskStop(taskId: string): Promise<{ ok: boolean }>;
  /** Approve a run paused at `review`, committing its side-effecting result and
   *  letting the remaining steps run. Nothing commits to the library without it. */
  taskApprove(taskId: string): Promise<{ ok: boolean }>;
  /** Local memory engine (production phase 5). Count + last-updated + the active
   *  embedding source, for the Console memory header. `recall`/`write` stay internal
   *  to the agent/ask path — only these read/manage controls cross the bridge. */
  memoryStats(): Promise<MemoryStats>;
  /** Search remembered facts for the Console memory view (hybrid recall; empty
   *  query lists the most-recent). Embeddings never cross the bridge. */
  memorySearch(query: string): Promise<MemoryRecord[]>;
  /** Forget one entry by id. `{ ok: false }` if memory is off or the id is unknown. */
  memoryForget(id: string): Promise<{ ok: boolean }>;
  /** Clear all memory (the Console "clear memory" control). Idempotent. */
  memoryClear(): Promise<{ ok: boolean }>;
  /** Subscribe to streamed task updates (a push channel). Returns an unsubscribe
   *  fn. Registered in preload (one of the two sanctioned `ipcRenderer.on`s). */
  onTaskUpdate(callback: (run: TaskRun) => void): () => void;
  /** Subscribe to streamed AI answer events (the second push channel, P4). Returns
   *  an unsubscribe fn. Registered in preload alongside `onTaskUpdate`. */
  onAiStream(callback: (event: AiStreamEvent) => void): () => void;
  /** Store/replace a secret by name in the OS-keychain-backed vault (P2). Resolves
   *  `{ ok: false }` if secure storage is unavailable or the value is empty —
   *  plaintext is **never** written. Names come from `SecretName` (shared). */
  setSecret(name: string, value: string): Promise<{ ok: boolean }>;
  /** Remove a secret. Idempotent — `{ ok: true }` even if it wasn't set. */
  clearSecret(name: string): Promise<{ ok: boolean }>;
  /** Which secrets are currently set — name → present. There is **no** matching
   *  `getSecret`: plaintext never leaves the main process. */
  secretStatus(): Promise<Record<string, boolean>>;
  openConsole(): Promise<void>;
  hideLauncher(): Promise<void>;
  /** The host platform, so the renderer can render OS-correct shortcut glyphs. */
  platform: Platform;
}

/** Host platform (mirrors Node's `process.platform`, kept dependency-free here). */
export type Platform = 'darwin' | 'win32' | 'linux' | (string & {});
