import { applyArguments, effectiveArguments, valuesToRecord } from '@cockpitzero/shared';
import { getConfig } from './config-service.js';
import { runAction } from './action-runner/index.js';
import { runWorkflow } from './workflow-runner.js';
import { recordUse } from './usage-service.js';
import { electronPorts } from '../infra/electron-ports.js';

/**
 * The one place a configured action / workflow / path is executed **by id** —
 * argument validation, `{token}` substitution, the action-runner call, and the
 * usage bump live here so the IPC layer (the user pressing Enter) and the agent
 * tools (`actions.run` / `workflows.run` / `apps.open`) share the exact same
 * path and can never drift. Resolves `{ ok, error? }` — never throws.
 */

export async function runActionById(
  actionId: string,
  values?: string[],
): Promise<{ ok: boolean; error?: string }> {
  const action = getConfig().actions.find((a) => a.id === actionId);
  if (!action) return { ok: false, error: `Unknown action: ${actionId}` };

  const args = effectiveArguments(action);
  const vals = args.map((_, i) => values?.[i]?.trim() ?? '');
  const missing = args.find((arg, i) => arg.required && vals[i] === '');
  if (missing) {
    return { ok: false, error: `This action requires “${missing.name}”.` };
  }

  try {
    const resolved = args.length > 0 ? applyArguments(action, valuesToRecord(args, vals)) : action;
    await runAction(resolved, electronPorts);
    recordUse(action.id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runWorkflowById(workflowId: string): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  const workflow = config.workflows.find((w) => w.id === workflowId);
  if (!workflow) return { ok: false, error: `Unknown workflow: ${workflowId}` };

  const byId = new Map(config.actions.map((a) => [a.id, a]));
  try {
    await runWorkflow(workflow, (id) => byId.get(id), electronPorts);
    recordUse(workflow.id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Open a file or application by absolute path (system-search results). */
export async function openPathById(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await electronPorts.openPath(path);
    recordUse(path);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
