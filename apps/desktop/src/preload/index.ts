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
  search: (query) => ipcRenderer.invoke(IpcChannels.search, query),
  runAction: (actionId) => ipcRenderer.invoke(IpcChannels.runAction, actionId),
  openSettings: () => ipcRenderer.invoke(IpcChannels.openSettings),
  hideLauncher: () => ipcRenderer.invoke(IpcChannels.hideLauncher),
};

contextBridge.exposeInMainWorld('api', api);
