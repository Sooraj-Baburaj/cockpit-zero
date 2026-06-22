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
import { getDigest, listRoutines, runRoutine } from '../services/routines/index.js';
import { approveTask, getTask, startTask, stopTask } from '../services/agent/index.js';
import { recordUse } from '../services/usage-service.js';
import { electronPorts } from '../infra/electron-ports.js';
import { hideLauncher, openConsole } from '../windows/index.js';

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

  // Routines (Phase 5). `runRoutine` fans out to (mock) sources, summarizes +
  // ranks via the AI service, stores the digest, and opens the briefing window;
  // `getDigest` returns the last-computed digest for the briefing surface.
  ipcMain.handle(IpcChannels.runRoutine, (_e, routineId: string) => runRoutine(routineId));

  ipcMain.handle(IpcChannels.getDigest, (_e, routineId: string) => getDigest(routineId));

  ipcMain.handle(IpcChannels.listRoutines, () => listRoutines());

  // AI task / agent layer (Phase 7). `taskRun` starts the agent loop and opens
  // the task window; progress streams to it over the `task:update` push channel.
  // `taskStop`/`taskApprove` drive the human-in-the-loop (halt / approve a review).
  ipcMain.handle(IpcChannels.taskRun, (_e, intent: string) => startTask(intent));

  ipcMain.handle(IpcChannels.taskGet, (_e, taskId: string) => getTask(taskId));

  ipcMain.handle(IpcChannels.taskStop, (_e, taskId: string) => stopTask(taskId));

  ipcMain.handle(IpcChannels.taskApprove, (_e, taskId: string) => approveTask(taskId));

  ipcMain.handle(IpcChannels.openConsole, () => {
    openConsole();
  });

  ipcMain.handle(IpcChannels.hideLauncher, () => {
    hideLauncher();
  });
}
