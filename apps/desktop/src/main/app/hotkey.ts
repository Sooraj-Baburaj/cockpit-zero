import { globalShortcut } from 'electron';
import { toggleLauncher } from '../windows/index.js';
import { isWaylandSession } from './wayland.js';

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

/**
 * Whether the global hotkey is (believed) live, plus the Wayland caveat. On
 * native Wayland `globalShortcut.register` can report success yet never fire,
 * so the Console treats `wayland: true` as "offer the `cockpitzero --toggle`
 * fallback" regardless of `registered`.
 */
export function hotkeyStatus(): { registered: boolean; wayland: boolean } {
  return { registered: current !== null, wayland: isWaylandSession() };
}

/**
 * Whether an accelerator can be bound right now — i.e. it isn't already claimed
 * by us or another app. The currently-bound hotkey counts as available to
 * itself (re-selecting it is a no-op, not a conflict). Best-effort: probes by
 * registering a throwaway handler and releasing it immediately, restoring no
 * state because the probe target is never the live binding.
 */
export function isHotkeyAvailable(accelerator: string): boolean {
  if (accelerator === current) return true;
  if (globalShortcut.isRegistered(accelerator)) return false;
  try {
    const ok = globalShortcut.register(accelerator, () => {});
    if (ok) globalShortcut.unregister(accelerator);
    return ok;
  } catch {
    return false;
  }
}

/** Release all global shortcuts (called on quit). */
export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
  current = null;
}
