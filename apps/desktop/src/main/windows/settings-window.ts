import { app, BrowserWindow } from 'electron';
import { loadEntry, secureWebPreferences } from './internal.js';

/** The normal-chrome settings / config-editor window. */

let settingsWindow: BrowserWindow | null = null;

/**
 * Bring the app to the foreground. The launcher runs as a background agent (dock
 * hidden on macOS), so opening a real window needs an explicit dock-show + focus
 * — otherwise the settings window can open behind whatever app is in front.
 */
function revealApp(): void {
  if (process.platform === 'darwin') {
    void app.dock?.show();
    app.focus({ steal: true });
  }
}

/** Open (or focus) the settings window. */
export function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    revealApp();
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 880,
    height: 640,
    show: false,
    title: 'CockpitZero Settings',
    webPreferences: secureWebPreferences,
  });

  // Show only once the renderer is painted, then pull it to the front.
  settingsWindow.once('ready-to-show', () => {
    revealApp();
    settingsWindow?.show();
    settingsWindow?.focus();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    // Return to background-agent mode (re-hide the dock icon) on macOS.
    if (process.platform === 'darwin') app.dock?.hide();
  });

  loadEntry(settingsWindow, 'settings');
}
