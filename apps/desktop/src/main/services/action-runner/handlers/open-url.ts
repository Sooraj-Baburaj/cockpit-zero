import type { Action } from '@cockpitzero/shared';
import type { ActionPorts } from '../ports.js';

/** Opens a URL in the user's default browser. */
export function openUrl(action: Extract<Action, { type: 'open-url' }>, ports: ActionPorts) {
  return ports.openExternal(action.url);
}
