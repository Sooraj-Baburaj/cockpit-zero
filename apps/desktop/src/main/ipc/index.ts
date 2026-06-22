import { ipcMain } from 'electron';
import { IpcChannels, applyArguments, effectiveArguments, valuesToRecord } from '@cockpitzero/shared';
import { getConfig, updateConfig } from '../services/config-service.js';
import { resolveLauncherQuery, searchSystem } from '../services/search-service.js';
import { runAction } from '../services/action-runner/index.js';
import { runWorkflow } from '../services/workflow-runner.js';
import { getFileIcon } from '../services/icon-service.js';
import { getFavicon } from '../services/favicon-service.js';
import { completePath } from '../services/path-complete.js';
import { aiService } from '../services/ai/index.js';
import { recordUse } from '../services/usage-service.js';
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

  ipcMain.handle(IpcChannels.searchSystem, (_e, input: string) => searchSystem(input));

  ipcMain.handle(IpcChannels.runAction, async (_e, actionId: string, values?: string[]) => {
    const action = getConfig().actions.find((a) => a.id === actionId);
    if (!action) return { ok: false, error: `Unknown action: ${actionId}` };

    const args = effectiveArguments(action);
    const vals = args.map((_, i) => values?.[i]?.trim() ?? '');
    const missing = args.find((arg, i) => arg.required && vals[i] === '');
    if (missing) {
      return { ok: false, error: `This action requires “${missing.name}”.` };
    }

    try {
      const resolved =
        args.length > 0 ? applyArguments(action, valuesToRecord(args, vals)) : action;
      await runAction(resolved, electronPorts);
      recordUse(action.id);
      // The renderer hides the launcher after showing run feedback.
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
      recordUse(workflow.id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IpcChannels.openPath, async (_e, path: string) => {
    try {
      await electronPorts.openPath(path);
      recordUse(path);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IpcChannels.getFileIcon, (_e, path: string) => getFileIcon(path));

  ipcMain.handle(IpcChannels.getFavicon, (_e, url: string) => getFavicon(url));

  ipcMain.handle(IpcChannels.completePath, (_e, input: string) => completePath(input));

  // AI foundation (Phase 1). The service selects the provider from config and
  // short-circuits when AI is disabled; `draftWorkflow` is a stub until Phase 4.
  ipcMain.handle(IpcChannels.askAI, (_e, prompt: string) => aiService.ask(prompt));

  ipcMain.handle(IpcChannels.draftWorkflow, (_e, description: string) =>
    aiService.draftWorkflow(description),
  );

  ipcMain.handle(IpcChannels.aiStatus, () => aiService.status());

  ipcMain.handle(IpcChannels.openSettings, () => {
    openSettings();
  });

  ipcMain.handle(IpcChannels.hideLauncher, () => {
    hideLauncher();
  });
}
