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
  runAction: (actionId, argument) => ipcRenderer.invoke(IpcChannels.runAction, actionId, argument),
  runWorkflow: (workflowId) => ipcRenderer.invoke(IpcChannels.runWorkflow, workflowId),
  openPath: (path) => ipcRenderer.invoke(IpcChannels.openPath, path),
  openSettings: () => ipcRenderer.invoke(IpcChannels.openSettings),
  hideLauncher: () => ipcRenderer.invoke(IpcChannels.hideLauncher),
};

contextBridge.exposeInMainWorld('api', api);
