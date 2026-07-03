import { describe, it, expect } from 'vitest';
import {
  applyArguments,
  effectiveArguments,
  extractTokens,
  hasArgument,
  splitArgumentValues,
} from './actions.js';
import type { Action } from './types.js';

const npm: Action = {
  id: 'npm',
  title: 'npm package',
  type: 'open-url',
  url: 'https://www.npmjs.com/package/{query}',
  arguments: [{ name: 'query', required: true }],
};

const repo: Action = {
  id: 'repo',
  title: 'Open repo',
  type: 'open-url',
  url: 'https://github.com/{owner}/{repo}',
  arguments: [
    { name: 'owner', required: true },
    { name: 'repo', required: true },
  ],
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
    expect(extractTokens(repo)).toEqual(['owner', 'repo']);
    expect(extractTokens(staticAction)).toEqual([]);
  });
});

describe('effectiveArguments', () => {
  it('uses declared arguments when present', () => {
    expect(effectiveArguments(repo).map((a) => a.name)).toEqual(['owner', 'repo']);
  });

  it('synthesizes one required parameter per token when none are declared', () => {
    const tokenOnly: Action = {
      id: 't',
      title: 'two tokens',
      type: 'open-url',
      url: 'https://x.test/{a}/{b}',
    };
    expect(effectiveArguments(tokenOnly)).toEqual([
      { name: 'a', required: true },
      { name: 'b', required: true },
    ]);
  });
});

describe('hasArgument', () => {
  it('detects declared arguments and tokens', () => {
    expect(hasArgument(npm)).toBe(true);
    expect(hasArgument(repo)).toBe(true);
    expect(hasArgument(staticAction)).toBe(false);
  });
});

describe('applyArguments', () => {
  it('URL-encodes each value into its own token', () => {
    const resolved = applyArguments(repo, { owner: 'anthropic', repo: 'claude code' });
    expect(resolved).toMatchObject({ url: 'https://github.com/anthropic/claude%20code' });
  });

  it('substitutes a single token', () => {
    const resolved = applyArguments(npm, { query: 'react dom' });
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
    expect(applyArguments(cmd, { query: 'hello world' })).toMatchObject({ args: ['hello world'] });
  });

  it('leaves tokens without a value empty', () => {
    const resolved = applyArguments(repo, { owner: 'anthropic' });
    expect(resolved).toMatchObject({ url: 'https://github.com/anthropic/' });
  });

  it('does not mutate the input action', () => {
    const before = npm.url;
    applyArguments(npm, { query: 'lodash' });
    expect(npm.url).toBe(before);
  });
});

describe('splitArgumentValues', () => {
  it('makes a single argument greedy (keeps internal spaces)', () => {
    expect(splitArgumentValues(1, 'hello world')).toEqual({
      values: ['hello world'],
      activeIndex: 0,
    });
  });

  it('maps words positionally with the last argument greedy', () => {
    expect(splitArgumentValues(2, 'anthropic claude code')).toEqual({
      values: ['anthropic', 'claude code'],
      activeIndex: 1,
    });
  });

  it('advances the active index once the current word is followed by a space', () => {
    expect(splitArgumentValues(2, 'anthropic ')).toEqual({
      values: ['anthropic', ''],
      activeIndex: 1,
    });
  });

  it('keeps the caret on the current word until a space is typed', () => {
    expect(splitArgumentValues(2, 'anth')).toEqual({ values: ['anth', ''], activeIndex: 0 });
  });

  it('pads missing trailing values with empty strings', () => {
    expect(splitArgumentValues(3, 'a b')).toEqual({ values: ['a', 'b', ''], activeIndex: 1 });
  });
});
