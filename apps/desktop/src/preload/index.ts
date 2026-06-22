import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type IpcApi } from '@cockpitzero/shared';

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
  draftWorkflow: (description) => ipcRenderer.invoke(IpcChannels.draftWorkflow, description),
  aiStatus: () => ipcRenderer.invoke(IpcChannels.aiStatus),
  runRoutine: (routineId) => ipcRenderer.invoke(IpcChannels.runRoutine, routineId),
  getDigest: (routineId) => ipcRenderer.invoke(IpcChannels.getDigest, routineId),
  listRoutines: () => ipcRenderer.invoke(IpcChannels.listRoutines),
  openSettings: () => ipcRenderer.invoke(IpcChannels.openSettings),
  hideLauncher: () => ipcRenderer.invoke(IpcChannels.hideLauncher),
  platform: process.platform,
};

contextBridge.exposeInMainWorld('api', api);
