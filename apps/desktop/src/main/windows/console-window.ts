import { app, BrowserWindow } from 'electron';
import { readConfig } from '../infra/store.js';
import { loadEntry, secureWebPreferences } from './internal.js';

/** The normal-chrome Console / config-editor window. */

let consoleWindow: BrowserWindow | null = null;

/** Opaque fallback background when frosted glass is off — Clarity's `--cz-bg-2`. */
const SOLID_BG = '#f1f4f9';

/**
 * Bring the app to the foreground. The launcher runs as a background agent (dock
 * hidden on macOS), so opening a real window needs an explicit dock-show + focus
 * — otherwise the Console window can open behind whatever app is in front.
 */
function revealApp(): void {
  if (process.platform === 'darwin') {
    void app.dock?.show();
    app.focus({ steal: true });
  }
}

/**
 * Apply (or remove) the OS-level frosted-glass effect on the Console window:
 * macOS vibrancy, Windows acrylic. Called at creation and live when the user
 * toggles "Frosted glass" in Appearance. With glass on the window background is
 * transparent so the effect shows through the translucent CSS surface.
 */
export function applyConsoleAppearance(glass: boolean): void {
  if (!consoleWindow || consoleWindow.isDestroyed()) return;
  const darwin = process.platform === 'darwin';
  const win32 = process.platform === 'win32';
  if (darwin) consoleWindow.setVibrancy(glass ? 'under-window' : null);
  else if (win32) consoleWindow.setBackgroundMaterial?.(glass ? 'acrylic' : 'none');
  consoleWindow.setBackgroundColor(glass && (darwin || win32) ? '#00000000' : SOLID_BG);
}

/** Open (or focus) the Console window. */
export function openConsole(): void {
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    revealApp();
    consoleWindow.show();
    consoleWindow.focus();
    return;
  }

  const glass = readConfig().settings.glass;
  const darwin = process.platform === 'darwin';
  const win32 = process.platform === 'win32';
  const frosted = glass && (darwin || win32);

  // Matches the design system's settings-window kits (1040×764).
  //
  // macOS drops the native title bar (`hiddenInset`) so the app's own chrome runs
  // edge to edge; the traffic lights stay, floated into the sidebar's header gap
  // (ConsoleLayout reserves room for them and supplies the drag region, since
  // there's no title bar left to drag).
  //
  // Windows/Linux keep their native frame: `titleBarStyle: 'hidden'` there
  // removes the window controls entirely unless a `titleBarOverlay` is drawn and
  // kept in sync with the theme — shipping that untested would leave those users
  // unable to close the window.
  consoleWindow = new BrowserWindow({
    width: 1040,
    height: 764,
    show: false,
    title: 'CockpitZero Console',
    backgroundColor: frosted ? '#00000000' : SOLID_BG,
    ...(darwin
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 18, y: 20 } }
      : {}),
    ...(glass && darwin ? { vibrancy: 'under-window' as const } : {}),
    ...(glass && win32 ? { backgroundMaterial: 'acrylic' as const } : {}),
    webPreferences: secureWebPreferences,
  });

  // Show only once the renderer is painted, then pull it to the front.
  consoleWindow.once('ready-to-show', () => {
    revealApp();
    consoleWindow?.show();
    consoleWindow?.focus();
  });

  consoleWindow.on('closed', () => {
    consoleWindow = null;
    // Return to background-agent mode (re-hide the dock icon) on macOS.
    if (process.platform === 'darwin') app.dock?.hide();
  });

  loadEntry(consoleWindow, 'console');
}
