import type { Action, ActionKind } from '@cockpitzero/shared';
import type { ActionPorts } from './ports.js';
import { openUrl } from './handlers/open-url.js';
import { openApp } from './handlers/open-app.js';
import { runCommand } from './handlers/run-command.js';
import { copySnippet } from './handlers/snippet.js';

/** A handler receives the action narrowed to its own `type`, plus the ports. */
export type ActionHandler<K extends ActionKind> = (
  action: Extract<Action, { type: K }>,
  ports: ActionPorts,
) => Promise<void> | void;

/**
 * Maps each action kind to its handler. The mapped type `{ [K in ActionKind] }`
 * makes the registry **exhaustive**: adding a new action kind to the shared
 * schema makes TypeScript error here until a handler is supplied. To add a kind,
 * drop a file in `handlers/` and register it below.
 */
export const handlers: { [K in ActionKind]: ActionHandler<K> } = {
  'open-url': openUrl,
  'open-app': openApp,
  'run-command': runCommand,
  snippet: copySnippet,
};
