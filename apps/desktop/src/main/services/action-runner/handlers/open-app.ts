import type { Action } from '@cockpitzero/shared';
import type { ActionPorts } from '../ports.js';

/** Opens an application, file, or folder via the OS default handler. */
export function openApp(action: Extract<Action, { type: 'open-app' }>, ports: ActionPorts) {
  return ports.openPath(action.target);
}
