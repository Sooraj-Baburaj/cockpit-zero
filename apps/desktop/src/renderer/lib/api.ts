import type { IpcApi } from '@cockpitzero/shared';

/**
 * Single import site for the preload bridge. Components import `api` from here
 * instead of reaching for `window.api` directly, keeping the IPC surface in one
 * typed place (and easy to stub in the future).
 */
export const api: IpcApi = window.api;
