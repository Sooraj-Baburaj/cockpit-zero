import { shell } from 'electron';
import { spawn } from 'node:child_process';
import { clipboard } from 'electron';
import type { Action } from '@cockpitzero/shared';

/**
 * Executes an action by its discriminated `type`. To add a new action type:
 * 1) add it to ActionSchema in packages/shared,
 * 2) add a `case` here,
 * 3) render it in the launcher. See CLAUDE.md → "How to add a new action type".
 */
export async function runAction(action: Action): Promise<void> {
  switch (action.type) {
    case 'open-url':
      await shell.openExternal(action.url);
      return;
    case 'open-app':
      await shell.openPath(action.target);
      return;
    case 'run-command':
      spawn(action.command, action.args, { detached: true, stdio: 'ignore' }).unref();
      return;
    case 'snippet':
      clipboard.writeText(action.content);
      return;
    default: {
      // Exhaustiveness check — TS errors here if a new action type is unhandled.
      const _never: never = action;
      throw new Error(`Unhandled action type: ${JSON.stringify(_never)}`);
    }
  }
}
