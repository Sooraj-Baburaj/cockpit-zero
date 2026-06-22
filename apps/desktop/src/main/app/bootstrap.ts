import { app } from 'electron';
import { registerIpcHandlers } from '../ipc/index.js';
import { getLauncherWindow, toggleLauncher } from '../windows/index.js';
import { getConfig } from '../services/config-service.js';
import { startRoutineScheduler, stopRoutineScheduler } from '../services/routines/index.js';
import { registerHotkey, unregisterHotkeys } from './hotkey.js';

/**
 * Composition root. Wires the app lifecycle: single-instance lock, IPC handlers,
 * the pre-created launcher window, and the global hotkey. The launcher runs as a
 * background agent (no dock icon, survives all windows closing).
 */
export function bootstrap(): void {
  // macOS: keep running with no visible windows (launcher is a background agent).
  if (process.platform === 'darwin') app.dock?.hide();

  // Single-instance lock — a second launch just toggles the launcher.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on('second-instance', () => toggleLauncher());

  void app.whenReady().then(() => {
    registerIpcHandlers();
    getLauncherWindow(); // pre-create so the first toggle is instant.

    const hotkey = getConfig().settings.hotkey;
    if (!registerHotkey(hotkey)) console.error(`Failed to register global hotkey: ${hotkey}`);

    // Fire scheduled routines (e.g. the morning digest) in the background.
    startRoutineScheduler();
  });

  app.on('will-quit', () => {
    unregisterHotkeys();
    stopRoutineScheduler();
  });

  // Background launcher: do not quit when all windows close.
  app.on('window-all-closed', () => {
    // intentionally no-op
  });
}
