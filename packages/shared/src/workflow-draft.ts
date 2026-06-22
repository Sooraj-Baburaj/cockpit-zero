import { createId } from './utils.js';
import type { Action, Workflow, WorkflowDraft } from './types.js';

/**
 * Pure draft → config materialization (Phase 4). Turning a reviewed
 * `WorkflowDraft` into persistable entities is kept here — dependency-free — so
 * both the renderer (which calls it on Save) and tests share one definition of
 * "what does saving a draft create", with no `electron` or React in sight.
 */

/** What saving a draft adds to config: new step actions + the workflow itself. */
export interface DraftMaterialization {
  /** Newly-created step actions to append to `config.actions` (fresh ids). */
  actions: Action[];
  /** The workflow whose `steps` reference every resolved step action id, in order. */
  workflow: Workflow;
}

/**
 * Materialize a (schema-valid) draft. Each step either points at an existing
 * action — passed straight through by id — or carries a proposed `action`, which
 * gets a fresh id and is appended to {@link DraftMaterialization.actions}. The
 * built `Workflow` lists the resolved ids in draft order. Pure: never mutates the
 * input draft or its actions.
 *
 * No alias is produced. Aliases target an action id (see `AliasSchema`) and the
 * launcher resolves them to actions — there is no workflow-alias mechanism, and
 * Phase 4 adds no new persisted shape. The draft's `keyword` stays a display
 * handle (it echoes the name); the saved workflow is found by its name.
 */
export function draftToConfig(draft: WorkflowDraft): DraftMaterialization {
  const actions: Action[] = [];
  const steps: string[] = [];

  for (const step of draft.steps) {
    // Prefer an existing action id; otherwise mint one for the proposed action.
    if (step.actionId) {
      steps.push(step.actionId);
    } else if (step.action) {
      const action: Action = { ...step.action, id: createId('act') };
      actions.push(action);
      steps.push(action.id);
    }
  }

  const workflow: Workflow = { id: createId('wf'), name: draft.name, steps };
  return { actions, workflow };
}
