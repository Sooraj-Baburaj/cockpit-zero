import type { Action } from '@cockpitzero/shared';
import type { ActionPorts } from '../ports.js';

/** Spawns a detached shell command that outlives the launcher. */
export function runCommand(action: Extract<Action, { type: 'run-command' }>, ports: ActionPorts) {
  ports.spawnDetached(action.command, action.args);
}
