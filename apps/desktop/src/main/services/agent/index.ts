import { SecretName, providerInfo, providerLabel } from '@cockpitzero/shared';
import type { AiProviderId, TaskRun } from '@cockpitzero/shared';
import { readConfig } from '../../infra/store.js';
import { fileReader } from '../../infra/agent/file-reader.js';
import { buildLanguageModel } from '../../infra/ai/sdk-provider.js';
import { openTaskWindow, sendTaskUpdate } from '../../windows/index.js';
import { integrationActions } from '../integrations/index.js';
import { secretsService } from '../secrets/index.js';
import { memoryService } from '../memory/index.js';
import { searchSystem } from '../search-service.js';
import { openPathById, runActionById, runWorkflowById } from '../launcher-exec.js';
import type { LauncherPort } from './tools/ports.js';
import { createToolRegistry } from './tools/registry.js';
import { createAgentLoop, type ResolvedModel } from './agent-loop.js';
import { createTaskRunner } from './task-runner.js';

/**
 * The wired agent service the IPC layer calls. This is the one place that couples the
 * pure task runner to its concrete dependencies — the shared memory engine (production
 * phase 5), the file-read port, the tool registry, the **real** bounded agent loop
 * (production phase 6), the config reader, and the streaming sink (forwarding every
 * snapshot to the task window). Mirrors how `ai/index` and `memory/index` wire their
 * pieces: the pure runner stays `electron`-free + unit-tested; the `electron` touches
 * (opening the window, `webContents.send`) and the provider/vault wiring live here.
 *
 * The loop's model is resolved fresh per run from `config.ai` + the secrets vault
 * (reusing the exact `buildLanguageModel` mapping the AI service + memory engine use),
 * so switching provider/model or pasting a key takes effect with no restart. When AI
 * is off, the provider is `mock`/`managed`, or a required key/base URL is missing,
 * `resolveModel` returns null — the loop reports `unconfigured` and the runner shows a
 * "connect a provider" note instead of faking a run (CLAUDE.md: no mocks in production).
 */

/** Launcher parity for the agent — the same execution/search paths the bar uses
 *  (`launcher-exec` / `search-service`), mapped to the tool port shape. */
const launcherPort: LauncherPort = {
  runAction: runActionById,
  runWorkflow: runWorkflowById,
  openPath: openPathById,
  async searchSystem(query) {
    const items = await searchSystem(query);
    return items
      .filter((i) => i.kind === 'app' || i.kind === 'file')
      .map((i) => ({ kind: i.kind, name: i.title, path: i.path }));
  },
};

const ports = { files: fileReader, integrations: integrationActions, launcher: launcherPort };

const getKey = (provider: AiProviderId) => secretsService.get(SecretName.providerKey(provider));

/** Resolve the AI-SDK model for the current config, or null when there's no real
 *  tool-calling model to drive the loop (AI off / `mock` / `managed` / missing key). */
function resolveModel(): ResolvedModel | null {
  const ai = readConfig().ai;
  if (!ai.enabled) return null;
  const info = providerInfo(ai.provider); // falsy for `mock` / `managed`
  if (!info || ai.model.trim() === '') return null;
  const key = getKey(ai.provider);
  if (info.requiresKey && !key) return null;
  if (info.requiresBaseUrl && !ai.baseUrl?.trim()) return null;
  return { model: buildLanguageModel(ai, key), label: providerLabel(ai.provider) };
}

const runner = createTaskRunner({
  registry: createToolRegistry(ports),
  memory: memoryService,
  ports,
  getConfig: readConfig,
  loop: createAgentLoop({ resolveModel }),
  // Stream each snapshot to the task window (a no-op until it exists / after close).
  emit: (run: TaskRun) => sendTaskUpdate(run),
});

/** Start an agent task and open its window. Returns the run id. */
export function startTask(intent: string): { taskId: string } {
  const result = runner.start(intent);
  openTaskWindow(result.taskId);
  return result;
}

/** The latest snapshot of a run (for `taskGet`), or null. */
export function getTask(taskId: string): TaskRun | null {
  return runner.get(taskId);
}

/** Halt a run (`taskStop`) — also aborts the in-flight model request. */
export function stopTask(taskId: string): { ok: boolean } {
  return runner.stop(taskId);
}

/** Approve a `review` pause (`taskApprove`), letting the side-effecting tool run. */
export function approveTask(taskId: string): { ok: boolean } {
  return runner.approve(taskId);
}
