import { app, BrowserWindow } from 'electron';
import { readConfig } from '../infra/store.js';
import { loadEntry, secureWebPreferences } from './internal.js';

/**
 * The dedicated AI chat window — session history in a sidebar, a streaming
 * conversation pane on the right. A real, closable `cz-window` like the
 * Console/Task windows (opaque facet slab; the "glass" is lighting, not blur —
 * translucency stays launcher-only per the design system).
 */

let aiWindow: BrowserWindow | null = null;

/** Opaque fallback background (warm linen) when frosted glass is off. */
const SOLID_BG = '#faf5ee';

const AI_WIDTH = 980;
const AI_HEIGHT = 700;

/** Bring the app to the foreground (the launcher runs dock-hidden on macOS). */
function revealApp(): void {
  if (process.platform === 'darwin') {
    void app.dock?.show();
    app.focus({ steal: true });
  }
}

/** Open (or focus) the AI chat window. */
export function openAiChatWindow(): void {
  if (aiWindow && !aiWindow.isDestroyed()) {
    revealApp();
    aiWindow.show();
    aiWindow.focus();
    return;
  }

  const glass = readConfig().settings.glass;
  const darwin = process.platform === 'darwin';
  const win32 = process.platform === 'win32';
  const frosted = glass && (darwin || win32);

  aiWindow = new BrowserWindow({
    width: AI_WIDTH,
    height: AI_HEIGHT,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'CockpitZero — AI',
    backgroundColor: frosted ? '#00000000' : SOLID_BG,
    ...(glass && darwin ? { vibrancy: 'under-window' as const } : {}),
    ...(glass && win32 ? { backgroundMaterial: 'acrylic' as const } : {}),
    webPreferences: secureWebPreferences,
  });

  aiWindow.once('ready-to-show', () => {
    revealApp();
    aiWindow?.show();
    aiWindow?.focus();
  });

  aiWindow.on('closed', () => {
    aiWindow = null;
    // Return to background-agent mode (re-hide the dock icon) on macOS.
    if (process.platform === 'darwin') app.dock?.hide();
  });

  loadEntry(aiWindow, 'ai');
}
