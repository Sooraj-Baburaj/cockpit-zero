import { contextBridge, ipcRenderer } from 'electron';
import {
  AI_STREAM_CHANNEL,
  IpcChannels,
  TASK_UPDATE_CHANNEL,
  type AiStreamEvent,
  type IpcApi,
  type TaskRun,
} from '@cockpitzero/shared';

/**
 * The typed bridge. This is the ONLY place in the app that touches ipcRenderer.
 * Renderer components call `window.api.*` — never ipcRenderer directly.
 * Channel names come from the shared IpcChannels constant so both sides agree.
 */
const api: IpcApi = {
  getConfig: () => ipcRenderer.invoke(IpcChannels.getConfig),
  setConfig: (config) => ipcRenderer.invoke(IpcChannels.setConfig, config),
  resolveQuery: (input) => ipcRenderer.invoke(IpcChannels.resolveQuery, input),
  searchSystem: (input) => ipcRenderer.invoke(IpcChannels.searchSystem, input),
  runAction: (actionId, values) => ipcRenderer.invoke(IpcChannels.runAction, actionId, values),
  runWorkflow: (workflowId) => ipcRenderer.invoke(IpcChannels.runWorkflow, workflowId),
  openPath: (path) => ipcRenderer.invoke(IpcChannels.openPath, path),
  getFileIcon: (path) => ipcRenderer.invoke(IpcChannels.getFileIcon, path),
  getFavicon: (url) => ipcRenderer.invoke(IpcChannels.getFavicon, url),
  completePath: (input) => ipcRenderer.invoke(IpcChannels.completePath, input),
  askAI: (prompt) => ipcRenderer.invoke(IpcChannels.askAI, prompt),
  askAIStream: (prompt) => ipcRenderer.invoke(IpcChannels.askAIStream, prompt),
  cancelAiStream: (streamId) => ipcRenderer.invoke(IpcChannels.cancelAiStream, streamId),
  draftWorkflow: (description) => ipcRenderer.invoke(IpcChannels.draftWorkflow, description),
  aiStatus: () => ipcRenderer.invoke(IpcChannels.aiStatus),
  runRoutine: (routineId) => ipcRenderer.invoke(IpcChannels.runRoutine, routineId),
  getDigest: (routineId) => ipcRenderer.invoke(IpcChannels.getDigest, routineId),
  listRoutines: () => ipcRenderer.invoke(IpcChannels.listRoutines),
  taskRun: (intent) => ipcRenderer.invoke(IpcChannels.taskRun, intent),
  taskGet: (taskId) => ipcRenderer.invoke(IpcChannels.taskGet, taskId),
  taskStop: (taskId) => ipcRenderer.invoke(IpcChannels.taskStop, taskId),
  taskApprove: (taskId) => ipcRenderer.invoke(IpcChannels.taskApprove, taskId),
  // The two push channels: subscribe to streamed task snapshots and streamed AI
  // answer events. These `ipcRenderer.on`s are the ONLY sanctioned ones (CLAUDE.md);
  // each returns an unsubscribe fn.
  onTaskUpdate: (callback) => {
    const listener = (_e: Electron.IpcRendererEvent, run: TaskRun) => callback(run);
    ipcRenderer.on(TASK_UPDATE_CHANNEL, listener);
    return () => ipcRenderer.removeListener(TASK_UPDATE_CHANNEL, listener);
  },
  onAiStream: (callback) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: AiStreamEvent) => callback(ev);
    ipcRenderer.on(AI_STREAM_CHANNEL, listener);
    return () => ipcRenderer.removeListener(AI_STREAM_CHANNEL, listener);
  },
  // Secrets vault (P2). Set/clear/status only — there is no `getSecret` bridge,
  // by design: plaintext never leaves the main process.
  setSecret: (name, value) => ipcRenderer.invoke(IpcChannels.setSecret, name, value),
  clearSecret: (name) => ipcRenderer.invoke(IpcChannels.clearSecret, name),
  secretStatus: () => ipcRenderer.invoke(IpcChannels.secretStatus),
  openConsole: () => ipcRenderer.invoke(IpcChannels.openConsole),
  hideLauncher: () => ipcRenderer.invoke(IpcChannels.hideLauncher),
  platform: process.platform,
};

contextBridge.exposeInMainWorld('api', api);
