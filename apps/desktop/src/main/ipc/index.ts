import { ipcMain } from 'electron';
import { IpcChannels, searchActions, type Config } from '@cockpitzero/shared';
import { readConfig, writeConfig } from '../store.js';
import { runAction } from '../actions.js';
import { hideLauncher, openSettings } from '../windows.js';

/**
 * Registers every IPC handler. Each handler maps 1:1 to an IpcChannels constant
 * and to a method on the preload bridge (src/preload/index.ts). Add new channels
 * in packages/shared first, then wire them here and in preload.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.getConfig, (): Config => readConfig());

  ipcMain.handle(IpcChannels.setConfig, (_e, config: unknown): Config => writeConfig(config));

  ipcMain.handle(IpcChannels.search, (_e, query: string) =>
    searchActions(query, readConfig().actions),
  );

  ipcMain.handle(IpcChannels.runAction, async (_e, actionId: string) => {
    const action = readConfig().actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, error: `Unknown action: ${actionId}` };
    try {
      await runAction(action);
      hideLauncher();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IpcChannels.openSettings, () => {
    openSettings();
  });

  ipcMain.handle(IpcChannels.hideLauncher, () => {
    hideLauncher();
  });
}
