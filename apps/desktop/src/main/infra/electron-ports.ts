import { clipboard, shell } from 'electron';
import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import type { ActionPorts } from '../services/action-runner/ports.js';

/**
 * The electron/OS-backed implementation of the action-runner's `ActionPorts`.
 * This is the adapter half of the port: the action runner depends only on the
 * `ActionPorts` interface, so it (and its handlers) stay testable with fakes and
 * free of any electron import. See CLAUDE.md → desktop tests stay electron-free.
 */

/**
 * Launch a Linux `.desktop` entry. `shell.openPath` would open the file itself
 * (usually in a text editor) — the entry has to be *executed* by the desktop
 * environment. Tries `gio launch` (GLib — present on effectively every desktop
 * distro), falls back to `gtk-launch <desktop-id>`, and only then to
 * `shell.openPath`. Fire-and-forget, like the rest of app launching.
 */
function launchDesktopEntry(path: string): void {
  const viaGtkLaunch = () => {
    const child = spawn('gtk-launch', [basename(path, '.desktop')], {
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', () => void shell.openPath(path));
    child.unref();
  };
  const child = spawn('gio', ['launch', path], { detached: true, stdio: 'ignore' });
  child.on('error', viaGtkLaunch);
  child.on('exit', (code) => {
    if (code !== null && code !== 0) viaGtkLaunch();
  });
  child.unref();
}

export const electronPorts: ActionPorts = {
  openExternal: (url) => shell.openExternal(url),
  openPath: async (path) => {
    if (process.platform === 'linux' && path.endsWith('.desktop')) {
      launchDesktopEntry(path);
      return;
    }
    await shell.openPath(path);
  },
  spawnDetached: (command, args) => {
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
  },
  writeClipboard: (text) => clipboard.writeText(text),
};
