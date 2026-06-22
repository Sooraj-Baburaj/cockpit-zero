import type { TaskRun } from '@cockpitzero/shared';
import { readConfig } from '../../infra/store.js';
import { createFileMemoryStore } from '../../infra/agent/memory-store.js';
import { fileReader } from '../../infra/agent/file-reader.js';
import { openTaskWindow, sendTaskUpdate } from '../../windows/index.js';
import { createMemoryService } from './memory-service.js';
import { createToolRegistry } from './tools/registry.js';
import { createMockPlanner } from './planner.js';
import { createTaskRunner } from './task-runner.js';

/**
 * The wired agent service the IPC layer calls (Phase 7). This is the one place
 * that couples the pure task runner to its concrete dependencies — the on-disk
 * memory store, the file-read port, the tool registry, the (mock) planner, the
 * config reader, and the streaming sink (forwarding every snapshot to the task
 * window). Mirrors how `ai/index` and `routines/index` wire their pieces: the
 * pure runner stays `electron`-free + unit-tested; the `electron` touches
 * (opening the window, `webContents.send`) live only here.
 */

const ports = { files: fileReader };

const memory = createMemoryService({
  store: createFileMemoryStore(),
  getConfig: readConfig,
});

const runner = createTaskRunner({
  registry: createToolRegistry(ports),
  memory,
  ports,
  getConfig: readConfig,
  plan: createMockPlanner(),
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

/** Halt a run (`taskStop`). */
export function stopTask(taskId: string): { ok: boolean } {
  return runner.stop(taskId);
}

/** Approve a `review` pause (`taskApprove`), committing the result. */
export function approveTask(taskId: string): { ok: boolean } {
  return runner.approve(taskId);
}
