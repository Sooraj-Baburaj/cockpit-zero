import { describe, it, expect, vi } from 'vitest';
import type { Action, Workflow } from '@cockpitzero/shared';
import { runWorkflow } from '../src/main/services/workflow-runner.js';
import type { ActionPorts } from '../src/main/services/action-runner/ports.js';

/**
 * The workflow runner is dependency-inverted (action lookup + ports), so we run
 * full workflows here with fakes — no electron, mirroring action-runner.test.ts.
 */
function fakePorts() {
  return {
    openExternal: vi.fn(async () => {}),
    openPath: vi.fn(async () => {}),
    spawnDetached: vi.fn(() => {}),
    writeClipboard: vi.fn(() => {}),
  } satisfies ActionPorts;
}

const actions: Record<string, Action> = {
  a1: { id: 'a1', title: 'GH', type: 'open-url', url: 'https://github.com' },
  a2: { id: 'a2', title: 'Snip', type: 'snippet', content: 'hello' },
};

describe('runWorkflow', () => {
  it('runs each step in order via the action runner', async () => {
    const ports = fakePorts();
    const workflow: Workflow = { id: 'w', name: 'W', steps: ['a1', 'a2'] };
    await runWorkflow(workflow, (id) => actions[id], ports);
    expect(ports.openExternal).toHaveBeenCalledWith('https://github.com');
    expect(ports.writeClipboard).toHaveBeenCalledWith('hello');
  });

  it('skips unknown step ids without throwing', async () => {
    const ports = fakePorts();
    const workflow: Workflow = { id: 'w', name: 'W', steps: ['missing', 'a1'] };
    await runWorkflow(workflow, (id) => actions[id], ports);
    expect(ports.openExternal).toHaveBeenCalledTimes(1);
  });
});
