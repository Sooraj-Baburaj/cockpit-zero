import type { Action } from '@cockpitzero/shared';
import type { ActionPorts } from '../ports.js';

/** Copies snippet text to the system clipboard. */
export function copySnippet(action: Extract<Action, { type: 'snippet' }>, ports: ActionPorts) {
  ports.writeClipboard(action.content);
}
