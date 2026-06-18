import { globalShortcut } from 'electron';
import { toggleLauncher } from '../windows/index.js';

/**
 * Global hotkey registration. Tracks the currently-bound accelerator so the
 * config-service can re-register it live when the user changes the hotkey in
 * settings (the old binding is released first).
 */

let current: string | null = null;

/** (Re)register the global shortcut. Returns false if the accelerator is taken. */
export function registerHotkey(accelerator: string): boolean {
  if (current) globalShortcut.unregister(current);
  const ok = globalShortcut.register(accelerator, toggleLauncher);
  current = ok ? accelerator : null;
  return ok;
}

/** Release all global shortcuts (called on quit). */
export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
  current = null;
}
