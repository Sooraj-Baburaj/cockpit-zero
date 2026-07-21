import { app } from 'electron';
import { registerIpcHandlers } from '../ipc/index.js';
import {
  getLauncherWindow,
  openAiChatWindow,
  openConsole,
  toggleLauncher,
} from '../windows/index.js';
import { getConfig } from '../services/config-service.js';
import { startRoutineScheduler, stopRoutineScheduler } from '../services/routines/index.js';
import { initMemory } from '../services/memory/index.js';
import { registerHotkey, unregisterHotkeys } from './hotkey.js';

/**
 * Composition root. Wires the app lifecycle: single-instance lock, IPC handlers,
 * the pre-created launcher window, and the global hotkey. The launcher runs as a
 * background agent (no dock icon, survives all windows closing).
 */
export function bootstrap(): void {
  // macOS: keep running with no visible windows (launcher is a background agent).
  if (process.platform === 'darwin') app.dock?.hide();

  // Single-instance lock — a second launch opens the user's configured surface
  // (Settings → General → "App icon opens"). `cockpitzero --toggle` is exempt:
  // it's the Wayland hotkey fallback bound to a system shortcut, so it always
  // summons the bar regardless of that preference.
  if (app.isPackaged && !app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  /** Open the screen the user chose for app-icon launches. */
  const openConfiguredScreen = () => {
    switch (getConfig().settings.appIconOpens) {
      case 'console':
        openConsole();
        return;
      case 'ai':
        openAiChatWindow();
        return;
      default:
        toggleLauncher();
    }
  };

  app.on('second-instance', (_e, argv) => {
    if (argv.includes('--toggle')) toggleLauncher();
    else openConfiguredScreen();
  });

  // macOS: clicking the Dock icon (visible while a window is open) re-activates
  // with no windows shown — honor the same preference there.
  app.on('activate', (_e, hasVisibleWindows) => {
    if (!hasVisibleWindows) openConfiguredScreen();
  });

  void app.whenReady().then(() => {
    registerIpcHandlers();
    getLauncherWindow(); // pre-create so the first toggle is instant.

    const hotkey = getConfig().settings.hotkey;
    if (!registerHotkey(hotkey)) console.error(`Failed to register global hotkey: ${hotkey}`);

    // `cockpitzero --toggle` when the app wasn't running yet: the system
    // shortcut started us, so show the bar immediately rather than just idling.
    if (process.argv.includes('--toggle')) toggleLauncher();

    // Fire scheduled routines (e.g. the morning digest) in the background.
    startRoutineScheduler();

    // One-time: migrate a v1 memory.json into LanceDB (best-effort, off the hot path).
    void initMemory();
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
