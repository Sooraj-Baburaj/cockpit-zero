import { BrowserWindow } from 'electron';
import { loadEntry, secureWebPreferences } from './internal.js';

/** The normal-chrome settings / config-editor window. */

let settingsWindow: BrowserWindow | null = null;

/** Open (or focus) the settings window. */
export function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 880,
    height: 640,
    title: 'CockpitZero Settings',
    webPreferences: secureWebPreferences,
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  loadEntry(settingsWindow, 'settings');
}
