/**
 * Whether we're running under a native Wayland session on Linux. Electron's
 * `globalShortcut` is X11-only — under Wayland registration either fails or
 * (worse) reports success and never fires — so callers surface the
 * "bind a system shortcut to `cockpitzero --toggle`" fallback instead.
 * Pure (platform + env in, boolean out) so it's testable without electron.
 */
export function isWaylandSession(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (platform !== 'linux') return false;
  return env['XDG_SESSION_TYPE'] === 'wayland' || !!env['WAYLAND_DISPLAY'];
}
