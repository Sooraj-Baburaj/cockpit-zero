import { app, globalShortcut } from 'electron';
import { registerIpcHandlers } from './ipc/index.js';
import { getLauncherWindow, toggleLauncher } from './windows.js';
import { readConfig } from './store.js';

// macOS: keep the app running with no visible windows (launcher is a background agent).
if (process.platform === 'darwin') app.dock?.hide();

// Single-instance lock — a second launch just toggles the launcher.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => toggleLauncher());

  app.whenReady().then(() => {
    registerIpcHandlers();
    getLauncherWindow(); // pre-create so the first toggle is instant.

    const hotkey = readConfig().settings.hotkey;
    const ok = globalShortcut.register(hotkey, toggleLauncher);
    if (!ok) console.error(`Failed to register global hotkey: ${hotkey}`);
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Background launcher: do not quit when all windows close.
app.on('window-all-closed', () => {
  // intentionally no-op (except could quit on non-macOS if desired)
});
