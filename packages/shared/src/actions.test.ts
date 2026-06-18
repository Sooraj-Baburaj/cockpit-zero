import { describe, it, expect } from 'vitest';
import { applyArgument, extractTokens, hasArgument } from './actions.js';
import type { Action } from './types.js';

const npm: Action = {
  id: 'npm',
  title: 'npm package',
  type: 'open-url',
  url: 'https://www.npmjs.com/package/{query}',
  argument: { name: 'query', required: true },
};

const staticAction: Action = {
  id: 'gh',
  title: 'Open GitHub',
  type: 'open-url',
  url: 'https://github.com',
};

describe('extractTokens', () => {
  it('lists unique token names', () => {
    expect(extractTokens(npm)).toEqual(['query']);
    expect(extractTokens(staticAction)).toEqual([]);
  });
});

describe('hasArgument', () => {
  it('detects declared arguments and tokens', () => {
    expect(hasArgument(npm)).toBe(true);
    expect(hasArgument(staticAction)).toBe(false);
  });
});

describe('applyArgument', () => {
  it('URL-encodes the value into url targets', () => {
    const resolved = applyArgument(npm, 'react dom');
    expect(resolved).toMatchObject({ url: 'https://www.npmjs.com/package/react%20dom' });
  });

  it('substitutes tokens in run-command fields without encoding', () => {
    const cmd: Action = {
      id: 'c',
      title: 'echo',
      type: 'run-command',
      command: 'echo',
      args: ['{query}'],
    };
    expect(applyArgument(cmd, 'hello world')).toMatchObject({ args: ['hello world'] });
  });

  it('does not mutate the input action', () => {
    const before = npm.url;
    applyArgument(npm, 'lodash');
    expect(npm.url).toBe(before);
  });
});
