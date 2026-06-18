import type { Config, SearchResult } from './types.js';

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
  search: 'launcher:search',
  runAction: 'launcher:run-action',
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
  search(query: string): Promise<SearchResult[]>;
  runAction(actionId: string): Promise<{ ok: boolean; error?: string }>;
  openSettings(): Promise<void>;
  hideLauncher(): Promise<void>;
}
