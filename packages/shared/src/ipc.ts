import type { AiAnswer, Config, LauncherItem, ResolvedQuery, WorkflowDraft } from './types.js';

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
  draftWorkflow: 'ai:draft-workflow',
  aiStatus: 'ai:status',
  openSettings: 'window:open-settings',
  hideLauncher: 'window:hide-launcher',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

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
   *  actions. Promise-based (resolve-once) — token streaming is a later phase. */
  askAI(prompt: string): Promise<AiAnswer>;
  /** Draft a workflow from a natural-language description. Stub here; Phase 4
   *  implements the real drafting. */
  draftWorkflow(description: string): Promise<WorkflowDraft>;
  /** Whether AI is enabled + reachable, for surfaces that show connected state. */
  aiStatus(): Promise<{ enabled: boolean; provider: string; ok: boolean }>;
  openSettings(): Promise<void>;
  hideLauncher(): Promise<void>;
  /** The host platform, so the renderer can render OS-correct shortcut glyphs. */
  platform: Platform;
}

/** Host platform (mirrors Node's `process.platform`, kept dependency-free here). */
export type Platform = 'darwin' | 'win32' | 'linux' | (string & {});
