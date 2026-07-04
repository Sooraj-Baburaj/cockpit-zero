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
  checkHotkey: (accelerator) => ipcRenderer.invoke(IpcChannels.checkHotkey, accelerator),
  askAI: (prompt) => ipcRenderer.invoke(IpcChannels.askAI, prompt),
  askAIStream: (prompt) => ipcRenderer.invoke(IpcChannels.askAIStream, prompt),
  cancelAiStream: (streamId) => ipcRenderer.invoke(IpcChannels.cancelAiStream, streamId),
  draftWorkflow: (description) => ipcRenderer.invoke(IpcChannels.draftWorkflow, description),
  aiStatus: () => ipcRenderer.invoke(IpcChannels.aiStatus),
  aiUsage: () => ipcRenderer.invoke(IpcChannels.aiUsage),
  runRoutine: (routineId) => ipcRenderer.invoke(IpcChannels.runRoutine, routineId),
  getDigest: (routineId) => ipcRenderer.invoke(IpcChannels.getDigest, routineId),
  listRoutines: () => ipcRenderer.invoke(IpcChannels.listRoutines),
  taskRun: (intent) => ipcRenderer.invoke(IpcChannels.taskRun, intent),
  taskGet: (taskId) => ipcRenderer.invoke(IpcChannels.taskGet, taskId),
  taskStop: (taskId) => ipcRenderer.invoke(IpcChannels.taskStop, taskId),
  taskApprove: (taskId) => ipcRenderer.invoke(IpcChannels.taskApprove, taskId),
  memoryStats: () => ipcRenderer.invoke(IpcChannels.memoryStats),
  memorySearch: (query) => ipcRenderer.invoke(IpcChannels.memorySearch, query),
  memoryForget: (id) => ipcRenderer.invoke(IpcChannels.memoryForget, id),
  memoryClear: () => ipcRenderer.invoke(IpcChannels.memoryClear),
  // Cloud memory + knowledge (P8) — opt-in, signed-in only (gated in main).
  memorySyncNow: () => ipcRenderer.invoke(IpcChannels.memorySyncNow),
  knowledgeIngest: (paths) => ipcRenderer.invoke(IpcChannels.knowledgeIngest, paths),
  knowledgeList: () => ipcRenderer.invoke(IpcChannels.knowledgeList),
  knowledgeRemove: (docId) => ipcRenderer.invoke(IpcChannels.knowledgeRemove, docId),
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
  // Integrations (P10). Tokens live in the main-process vault — only ok/error
  // and metadata-only status cross the bridge.
  connectSource: (source, token) => ipcRenderer.invoke(IpcChannels.connectSource, source, token),
  disconnectSource: (source) => ipcRenderer.invoke(IpcChannels.disconnectSource, source),
  connectionStatus: () => ipcRenderer.invoke(IpcChannels.connectionStatus),
  // Backend account + sync (P7). The session token stays in the main-process
  // vault — only status/results cross the bridge.
  signIn: (method, credentials) => ipcRenderer.invoke(IpcChannels.signIn, method, credentials),
  signOut: () => ipcRenderer.invoke(IpcChannels.signOut),
  authStatus: () => ipcRenderer.invoke(IpcChannels.authStatus),
  syncPush: () => ipcRenderer.invoke(IpcChannels.syncPush),
  syncPull: () => ipcRenderer.invoke(IpcChannels.syncPull),
  openConsole: () => ipcRenderer.invoke(IpcChannels.openConsole),
  hideLauncher: () => ipcRenderer.invoke(IpcChannels.hideLauncher),
  platform: process.platform,
};

contextBridge.exposeInMainWorld('api', api);
