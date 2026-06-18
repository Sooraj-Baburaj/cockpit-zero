import type { BrowserWindow } from 'electron';
import { join } from 'node:path';

/** Shared window plumbing used by both the launcher and settings windows. */

export const isDev = !!process.env['ELECTRON_RENDERER_URL'];
export const preload = join(__dirname, '../preload/index.js');

/** Hardened webPreferences shared by every window (context isolation + sandbox). */
export const secureWebPreferences = {
  preload,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

/** Load a named renderer entry (launcher | settings) in dev or prod. */
export function loadEntry(win: BrowserWindow, entry: 'launcher' | 'settings') {
  if (isDev) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${entry}.html`);
  } else {
    void win.loadFile(join(__dirname, `../renderer/${entry}.html`));
  }
}
