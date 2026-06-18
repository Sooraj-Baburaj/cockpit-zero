import { describe, it, expect, vi } from 'vitest';
import type { Action } from '@cockpitzero/shared';
import { runAction } from '../src/main/services/action-runner/index.js';
import { handlers } from '../src/main/services/action-runner/registry.js';
import type { ActionPorts } from '../src/main/services/action-runner/ports.js';

/**
 * The action runner is dependency-inverted: it depends on the ActionPorts
 * interface, not electron. That lets us exercise every handler here with fakes —
 * no electron import — per the CLAUDE.md testing convention.
 */
function fakePorts() {
  return {
    openExternal: vi.fn(async () => {}),
    openPath: vi.fn(async () => {}),
    spawnDetached: vi.fn(() => {}),
    writeClipboard: vi.fn(() => {}),
  } satisfies ActionPorts;
}

describe('action-runner registry', () => {
  it('has a handler for every action kind (exhaustive)', () => {
    // ActionType is the runtime list of discriminants from the shared schema.
    expect(Object.keys(handlers).sort()).toEqual(
      ['open-url', 'open-app', 'run-command', 'snippet'].sort(),
    );
  });
});

describe('runAction', () => {
  it('routes open-url to openExternal', async () => {
    const ports = fakePorts();
    const action: Action = { id: '1', title: 'GH', type: 'open-url', url: 'https://github.com' };
    await runAction(action, ports);
    expect(ports.openExternal).toHaveBeenCalledWith('https://github.com');
  });

  it('routes open-app to openPath', async () => {
    const ports = fakePorts();
    const action: Action = { id: '2', title: 'App', type: 'open-app', target: '/Applications/X.app' };
    await runAction(action, ports);
    expect(ports.openPath).toHaveBeenCalledWith('/Applications/X.app');
  });

  it('routes run-command to spawnDetached', async () => {
    const ports = fakePorts();
    const action: Action = {
      id: '3',
      title: 'Echo',
      type: 'run-command',
      command: 'echo',
      args: ['hi'],
    };
    await runAction(action, ports);
    expect(ports.spawnDetached).toHaveBeenCalledWith('echo', ['hi']);
  });

  it('routes snippet to writeClipboard', async () => {
    const ports = fakePorts();
    const action: Action = { id: '4', title: 'Snip', type: 'snippet', content: 'hello' };
    await runAction(action, ports);
    expect(ports.writeClipboard).toHaveBeenCalledWith('hello');
  });
});
