import type { Config, ResolvedQuery } from './types.js';

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
  runAction: 'launcher:run-action',
  runWorkflow: 'launcher:run-workflow',
  openPath: 'launcher:open-path',
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
  /** Interpret raw input → ranked results or an argument-capture state (L2). */
  resolveQuery(input: string): Promise<ResolvedQuery>;
  /** Run an action; `argument` fills `{token}`s for parameterized actions. */
  runAction(actionId: string, argument?: string): Promise<{ ok: boolean; error?: string }>;
  /** Run a workflow's steps in sequence (Level 3). */
  runWorkflow(workflowId: string): Promise<{ ok: boolean; error?: string }>;
  /** Open a file or application by absolute path (system-search results). */
  openPath(path: string): Promise<{ ok: boolean; error?: string }>;
  openSettings(): Promise<void>;
  hideLauncher(): Promise<void>;
}
