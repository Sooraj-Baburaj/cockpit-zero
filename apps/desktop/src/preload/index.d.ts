import type { IpcApi } from '@cockpitzero/shared';

/** Makes `window.api` fully typed everywhere in the renderer. */
declare global {
  interface Window {
    api: IpcApi;
  }
}

export {};
