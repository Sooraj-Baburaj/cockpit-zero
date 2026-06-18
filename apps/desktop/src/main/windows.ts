import { BrowserWindow, screen, shell } from 'electron';
import { join } from 'node:path';

const isDev = !!process.env['ELECTRON_RENDERER_URL'];
const preload = join(__dirname, '../preload/index.js');

/** Load a named renderer entry (launcher | settings) in dev or prod. */
function loadEntry(win: BrowserWindow, entry: 'launcher' | 'settings') {
  if (isDev) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${entry}.html`);
  } else {
    void win.loadFile(join(__dirname, `../renderer/${entry}.html`));
  }
}

let launcherWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

const LAUNCHER_WIDTH = 720;
const LAUNCHER_HEIGHT = 480;

/** Create (once) the frameless, transparent launcher bar. Hidden by default. */
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
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Hide on blur so it behaves like Spotlight.
  launcherWindow.on('blur', () => launcherWindow?.hide());

  // Open external links in the user's browser, never in-app.
  launcherWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
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

/** Open (or focus) the normal-chrome settings window. */
export function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 880,
    height: 640,
    title: 'CockpitZero Settings',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  loadEntry(settingsWindow, 'settings');
}
