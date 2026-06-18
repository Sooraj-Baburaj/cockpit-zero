import { ipcMain } from 'electron';
import { IpcChannels, applyArgument, hasArgument } from '@cockpitzero/shared';
import { getConfig, updateConfig } from '../services/config-service.js';
import { resolveLauncherQuery } from '../services/search-service.js';
import { runAction } from '../services/action-runner/index.js';
import { runWorkflow } from '../services/workflow-runner.js';
import { electronPorts } from '../infra/electron-ports.js';
import { hideLauncher, openSettings } from '../windows/index.js';

/**
 * Registers every IPC handler. Each handler maps 1:1 to an IpcChannels constant
 * and to a method on the preload bridge (src/preload/index.ts). This layer is
 * thin: it validates/serializes and delegates to services. Add new channels in
 * packages/shared first, then wire them here and in preload.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.getConfig, () => getConfig());

  ipcMain.handle(IpcChannels.setConfig, (_e, config: unknown) => updateConfig(config));

  ipcMain.handle(IpcChannels.resolveQuery, (_e, input: string) => resolveLauncherQuery(input));

  ipcMain.handle(IpcChannels.runAction, async (_e, actionId: string, argument?: string) => {
    const action = getConfig().actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, error: `Unknown action: ${actionId}` };

    const arg = argument?.trim() ?? '';
    if (hasArgument(action) && action.argument?.required && arg === '') {
      return { ok: false, error: 'This action requires an argument.' };
    }

    try {
      const resolved = arg !== '' ? applyArgument(action, arg) : action;
      await runAction(resolved, electronPorts);
      hideLauncher();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IpcChannels.runWorkflow, async (_e, workflowId: string) => {
    const config = getConfig();
    const workflow = config.workflows.find((w) => w.id === workflowId);
    if (!workflow) return { ok: false, error: `Unknown workflow: ${workflowId}` };

    const byId = new Map(config.actions.map((a) => [a.id, a]));
    try {
      await runWorkflow(workflow, (id) => byId.get(id), electronPorts);
      hideLauncher();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IpcChannels.openPath, async (_e, path: string) => {
    try {
      await electronPorts.openPath(path);
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
