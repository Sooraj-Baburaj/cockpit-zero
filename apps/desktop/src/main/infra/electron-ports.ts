import { clipboard, shell } from 'electron';
import { spawn } from 'node:child_process';
import type { ActionPorts } from '../services/action-runner/ports.js';

/**
 * The electron/OS-backed implementation of the action-runner's `ActionPorts`.
 * This is the adapter half of the port: the action runner depends only on the
 * `ActionPorts` interface, so it (and its handlers) stay testable with fakes and
 * free of any electron import. See CLAUDE.md → desktop tests stay electron-free.
 */
export const electronPorts: ActionPorts = {
  openExternal: (url) => shell.openExternal(url),
  openPath: async (path) => {
    await shell.openPath(path);
  },
  spawnDetached: (command, args) => {
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
  },
  writeClipboard: (text) => clipboard.writeText(text),
};
