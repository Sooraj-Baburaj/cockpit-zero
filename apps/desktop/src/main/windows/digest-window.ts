import { app, BrowserWindow, shell } from 'electron';
import { readConfig } from '../infra/store.js';
import { loadEntry, secureWebPreferences } from './internal.js';

/** The routine briefing window — a dedicated surface that renders a routine's
 *  digest (the delivery target for `deliver: 'window'`). Mirrors the Console
 *  window's chrome (a real, closable, frosted window) but sized for the briefing. */

let digestWindow: BrowserWindow | null = null;

/** Opaque fallback background (warm linen) when frosted glass is off. */
const SOLID_BG = '#faf5ee';

const DIGEST_WIDTH = 780;
const DIGEST_HEIGHT = 720;

/** Bring the app to the foreground (the launcher runs dock-hidden on macOS). */
function revealApp(): void {
  if (process.platform === 'darwin') {
    void app.dock?.show();
    app.focus({ steal: true });
  }
}

/**
 * Open (or focus) the digest window for a routine. When it's already open we
 * reload it with the new routine id so it re-fetches the freshly computed digest
 * (the renderer reads the id from the URL hash and calls `getDigest`).
 */
export function openDigestWindow(routineId: string): void {
  if (digestWindow && !digestWindow.isDestroyed()) {
    loadEntry(digestWindow, 'digest', routineId);
    revealApp();
    digestWindow.show();
    digestWindow.focus();
    return;
  }

  const glass = readConfig().settings.glass;
  const darwin = process.platform === 'darwin';
  const win32 = process.platform === 'win32';
  const frosted = glass && (darwin || win32);

  digestWindow = new BrowserWindow({
    width: DIGEST_WIDTH,
    height: DIGEST_HEIGHT,
    show: false,
    title: 'CockpitZero — Briefing',
    backgroundColor: frosted ? '#00000000' : SOLID_BG,
    ...(glass && darwin ? { vibrancy: 'under-window' as const } : {}),
    ...(glass && win32 ? { backgroundMaterial: 'acrylic' as const } : {}),
    webPreferences: secureWebPreferences,
  });

  // Open external links (an item's `↵ open`) in the user's browser, never in-app.
  digestWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  digestWindow.once('ready-to-show', () => {
    revealApp();
    digestWindow?.show();
    digestWindow?.focus();
  });

  digestWindow.on('closed', () => {
    digestWindow = null;
    if (process.platform === 'darwin') app.dock?.hide();
  });

  loadEntry(digestWindow, 'digest', routineId);
}
