import type { Action, Workflow } from '@cockpitzero/shared';
import type { ActionPorts } from './action-runner/ports.js';
import { runAction } from './action-runner/index.js';

/**
 * Runs a workflow's steps in sequence (Level 3 — basic). Each step is an action
 * id resolved through the injected `lookup`; unknown ids are skipped so a deleted
 * action doesn't break the rest of the chain. Dependency-inverted (takes the
 * lookup + ports, never electron) so it's unit-testable with fakes, mirroring the
 * action-runner. Per-step arguments and conditionals are intentionally deferred.
 */
export async function runWorkflow(
  workflow: Workflow,
  lookup: (actionId: string) => Action | undefined,
  ports: ActionPorts,
): Promise<void> {
  for (const stepId of workflow.steps) {
    const action = lookup(stepId);
    if (!action) continue;
    await runAction(action, ports);
  }
}
