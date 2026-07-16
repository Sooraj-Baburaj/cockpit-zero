import { existsSync } from 'node:fs';
import { BrowserWindow, screen, shell } from 'electron';
import { isDev, loadEntry, secureWebPreferences } from './internal.js';

/** The frameless, transparent Spotlight-style command bar. */

/* The design system's command panel is 620px wide; the window adds 40px of
   transparent margin per side so the panel's wide soft shadow (and its appear
   animation) render without clipping. LauncherLayout's p-10 is the other half
   of this contract. */
const LAUNCHER_WIDTH = 700;
const LAUNCHER_HEIGHT = 520;

let launcherWindow: BrowserWindow | null = null;

/** Create (once) the launcher bar. Hidden by default; pre-created at startup. */
export function getLauncherWindow(): BrowserWindow {
  if (launcherWindow && !launcherWindow.isDestroyed()) return launcherWindow;

  launcherWindow = new BrowserWindow({
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    webPreferences: secureWebPreferences,
  });

  // Hide on blur so it behaves like Spotlight (only in production so DevTools don't auto-hide it in dev).
  if (!isDev) {
    launcherWindow.on('blur', () => launcherWindow?.hide());
  }

  // Open external links in the user's browser, never in-app.
  launcherWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  console.log(
    `[preload-path] sandbox=${secureWebPreferences.sandbox} preload=${secureWebPreferences.preload} exists=${existsSync(secureWebPreferences.preload)}`,
  );
  launcherWindow.webContents.on('preload-error', (_e, path, error) => {
    console.error(`[preload-error] ${path}\n${error.stack ?? error}`);
  });
  loadEntry(launcherWindow, 'launcher');
  return launcherWindow;
}

/** Toggle launcher visibility, centering it near the top of the active display. */
export function toggleLauncher(): void {
  const win = getLauncherWindow();
  if (win.isVisible()) {
    win.hide();
    return;
  }
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width } = display.workArea;
  win.setBounds({
    x: Math.round(x + (width - LAUNCHER_WIDTH) / 2),
    y: Math.round(y + display.workArea.height * 0.18),
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
  });
  win.show();
  win.focus();
}

export function hideLauncher(): void {
  if (launcherWindow && !launcherWindow.isDestroyed()) launcherWindow.hide();
}
