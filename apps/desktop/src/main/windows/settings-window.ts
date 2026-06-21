import { app, BrowserWindow } from 'electron';
import { readConfig } from '../infra/store.js';
import { loadEntry, secureWebPreferences } from './internal.js';

/** The normal-chrome settings / config-editor window. */

let settingsWindow: BrowserWindow | null = null;

/** Opaque fallback background (warm linen) when frosted glass is off. */
const SOLID_BG = '#faf5ee';

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

/**
 * Apply (or remove) the OS-level frosted-glass effect on the settings window:
 * macOS vibrancy, Windows acrylic. Called at creation and live when the user
 * toggles "Frosted glass" in Appearance. With glass on the window background is
 * transparent so the effect shows through the translucent CSS surface.
 */
export function applySettingsAppearance(glass: boolean): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  const darwin = process.platform === 'darwin';
  const win32 = process.platform === 'win32';
  if (darwin) settingsWindow.setVibrancy(glass ? 'under-window' : null);
  else if (win32) settingsWindow.setBackgroundMaterial?.(glass ? 'acrylic' : 'none');
  settingsWindow.setBackgroundColor(glass && (darwin || win32) ? '#00000000' : SOLID_BG);
}

/** Open (or focus) the settings window. */
export function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    revealApp();
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const glass = readConfig().settings.glass;
  const darwin = process.platform === 'darwin';
  const win32 = process.platform === 'win32';
  const frosted = glass && (darwin || win32);

  settingsWindow = new BrowserWindow({
    width: 880,
    height: 640,
    show: false,
    title: 'CockpitZero Settings',
    backgroundColor: frosted ? '#00000000' : SOLID_BG,
    ...(glass && darwin ? { vibrancy: 'under-window' as const } : {}),
    ...(glass && win32 ? { backgroundMaterial: 'acrylic' as const } : {}),
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
