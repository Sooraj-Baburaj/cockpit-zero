import type { Action } from '@cockpitzero/shared';
import type { ActionPorts } from './ports.js';
import { handlers } from './registry.js';

/**
 * Executes an action by dispatching on its discriminated `type` to the matching
 * handler. Pure with respect to electron — all side effects go through the
 * injected `ports`, so this is unit-testable with fakes.
 *
 * Parameterized actions should already have their `{tokens}` substituted (via
 * `applyArgument` in the IPC layer) before reaching here.
 */
export function runAction(action: Action, ports: ActionPorts): Promise<void> | void {
  const handler = handlers[action.type];
  // Safe: the registry is keyed by the same discriminant we index with.
  return handler(action as never, ports);
}
