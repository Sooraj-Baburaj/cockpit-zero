import type { AccountStatus, PasswordCredentials, SignInMethod } from './account.js';
import type { ChatSession, ChatSummary } from './chat.js';
import type { AiUsageSummary } from './inference.js';
import type { ConnectionStatus } from './integrations.js';
import type { KnowledgeDoc, MemorySyncResult } from './memory-sync.js';
import type {
  AiAnswer,
  AiStreamEvent,
  Config,
  Digest,
  IntegrationSourceId,
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
  checkHotkey: 'system:check-hotkey',
  hotkeyStatus: 'system:hotkey-status',
  askAI: 'ai:ask',
  askAIStream: 'ai:ask-stream',
  cancelAiStream: 'ai:ask-cancel',
  draftWorkflow: 'ai:draft-workflow',
  aiStatus: 'ai:status',
  aiUsage: 'ai:usage',
  runRoutine: 'routine:run',
  getDigest: 'routine:get-digest',
  listRoutines: 'routine:list',
  taskRun: 'task:run',
  taskGet: 'task:get',
  taskStop: 'task:stop',
  taskApprove: 'task:approve',
  chatList: 'chat:list',
  chatGet: 'chat:get',
  chatCreate: 'chat:create',
  chatDelete: 'chat:delete',
  chatAsk: 'chat:ask',
  memoryStats: 'memory:stats',
  memorySearch: 'memory:search',
  memoryForget: 'memory:forget',
  memoryClear: 'memory:clear',
  memorySyncNow: 'memory:sync',
  knowledgeIngest: 'knowledge:ingest',
  knowledgeList: 'knowledge:list',
  knowledgeRemove: 'knowledge:remove',
  setSecret: 'secret:set',
  clearSecret: 'secret:clear',
  secretStatus: 'secret:status',
  secretsAvailable: 'secret:available',
  connectSource: 'integration:connect',
  disconnectSource: 'integration:disconnect',
  connectionStatus: 'integration:status',
  signIn: 'auth:sign-in',
  signOut: 'auth:sign-out',
  authStatus: 'auth:status',
  syncPush: 'sync:push',
  syncPull: 'sync:pull',
  openConsole: 'window:open-console',
  openAiChat: 'window:open-ai-chat',
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
  /** Whether a global-hotkey accelerator is free to bind (not taken by us or
   *  another app). Used by the hotkey recorder to reject a conflicting chord
   *  before it's committed to config. The current hotkey counts as available. */
  checkHotkey(accelerator: string): Promise<boolean>;
  /** Whether the configured global hotkey actually registered, plus whether the
   *  session is Wayland (where Electron global shortcuts don't work — the
   *  Console then offers the `cockpitzero --toggle` system-shortcut fallback). */
  hotkeyStatus(): Promise<{ registered: boolean; wayland: boolean }>;
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
  /** Managed-inference usage this period (P9): requests + tokens metered by the
   *  backend per user. Resolves `{ ok: false, error }` when signed out. */
  aiUsage(): Promise<AiUsageSummary>;
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
  /** The AI window's session sidebar — summaries only, newest first. */
  chatList(): Promise<ChatSummary[]>;
  /** One session's full transcript, or null if the id is unknown. */
  chatGet(sessionId: string): Promise<ChatSession | null>;
  /** Start (or reuse the newest empty) chat session. */
  chatCreate(): Promise<ChatSession>;
  /** Delete a session and its transcript. Idempotent. */
  chatDelete(sessionId: string): Promise<{ ok: boolean }>;
  /** Send a chat message: the user turn persists immediately, the assistant's
   *  reply streams back over `onAiStream` (same `AiStreamEvent`s as the bar)
   *  and persists in the main process when it completes — so a closed window
   *  never loses the exchange. Resolves `{ error }` with no streamId when the
   *  session is unknown or the text is blank. */
  chatAsk(sessionId: string, text: string): Promise<{ streamId?: string; error?: string }>;
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
  /** Cloud memory sync (production phase 8): push local deltas to the backend and
   *  pull remote ones down (LWW + server dedup). Requires signed-in +
   *  `ai.memorySync` on — otherwise resolves `{ ok: false, error }`. */
  memorySyncNow(): Promise<MemorySyncResult>;
  /** Ingest documents into the cloud knowledge base (P8). Empty `paths` opens the
   *  native file picker in the main process; the files are extracted, chunked, and
   *  embedded **server-side**. Signed-in only. */
  knowledgeIngest(paths: string[]): Promise<{ ok: boolean; docIds: string[]; error?: string }>;
  /** The user's ingested knowledge documents (Console → Memory → Knowledge). */
  knowledgeList(): Promise<{ ok: boolean; docs: KnowledgeDoc[]; error?: string }>;
  /** Remove one ingested document (deletes its chunks server-side — a real
   *  deletion, not a soft hide). */
  knowledgeRemove(docId: string): Promise<{ ok: boolean; error?: string }>;
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
  /** Whether OS-keychain-backed secure storage is available at all — false e.g.
   *  on Linux without a keyring (libsecret). Surfaces let the user know keys
   *  can't be saved *before* they try, instead of failing the save. */
  secretsAvailable(): Promise<boolean>;
  /** Connect an integration (P10). With no `token` it runs the system-browser
   *  OAuth flow (loopback callback); with a pasted `token` it validates the
   *  credential against the service. Either way the token lands in the vault —
   *  it never crosses back over the bridge. */
  connectSource(
    source: IntegrationSourceId,
    token?: string,
  ): Promise<{ ok: boolean; error?: string }>;
  /** Disconnect an integration: best-effort remote revoke + clear the vault
   *  token + drop the connection metadata. */
  disconnectSource(source: IntegrationSourceId): Promise<{ ok: boolean; error?: string }>;
  /** Connection state for every source (metadata only, never tokens). */
  connectionStatus(): Promise<ConnectionStatus[]>;
  /** Sign in to the (optional) backend account (P7). OAuth methods open the
   *  system browser and resolve when the loopback callback lands; `password`
   *  posts the inline credentials (`create: true` = sign-up). The session token
   *  goes straight into the vault — it never crosses back over the bridge. */
  signIn(
    method: SignInMethod,
    credentials?: PasswordCredentials,
  ): Promise<{ ok: boolean; error?: string }>;
  /** Sign out: revoke the backend session (best-effort) and clear the vault token. */
  signOut(): Promise<void>;
  /** Whoami — signed-in state + email/plan for the Account panel. Resolves
   *  `{ signedIn: false }` when logged out or the backend is unreachable. */
  authStatus(): Promise<AccountStatus>;
  /** Push the current local Config to the backend (`POST /sync`, LWW). */
  syncPush(): Promise<{ ok: boolean; syncedAt?: string; error?: string }>;
  /** Pull the latest cloud Config (`GET /sync`) — `null` if never pushed. The
   *  renderer decides whether to apply it (via `setConfig`). */
  syncPull(): Promise<{ ok: boolean; config: Config | null; error?: string }>;
  openConsole(): Promise<void>;
  /** Open (or focus) the dedicated AI chat window. */
  openAiChat(): Promise<void>;
  hideLauncher(): Promise<void>;
  /** The host platform, so the renderer can render OS-correct shortcut glyphs. */
  platform: Platform;
}

/** Host platform (mirrors Node's `process.platform`, kept dependency-free here). */
export type Platform = 'darwin' | 'win32' | 'linux' | (string & {});
