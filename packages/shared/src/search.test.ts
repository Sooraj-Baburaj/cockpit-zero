import { describe, it, expect } from 'vitest';
import { fuzzyRank, resolveQuery, searchActions, searchConfig } from './search.js';
import { defaultConfig } from './config.js';
import type { Config } from './types.js';

const config: Config = {
  ...defaultConfig(),
  actions: [
    { id: 'a1', title: 'Open GitHub', type: 'open-url', url: 'https://github.com' },
    { id: 'a2', title: 'Open Gmail', type: 'open-url', url: 'https://mail.google.com' },
    {
      id: 'g',
      title: 'Google search',
      type: 'open-url',
      url: 'https://www.google.com/search?q={query}',
      argument: { name: 'query', placeholder: 'search terms', required: true },
    },
  ],
  aliases: [
    { id: 'al1', keyword: 'gh', label: 'GitHub', actionId: 'a1' },
    { id: 'al2', keyword: 'g', label: 'Google', actionId: 'g' },
  ],
};

describe('fuzzyRank', () => {
  it('matches subsequences and skips non-matches', () => {
    const matched = fuzzyRank('git', ['github', 'gitlab', 'bitbucket'], (s) => s).map(
      (r) => r.item,
    );
    expect(matched).toContain('github');
    expect(matched).toContain('gitlab');
    expect(matched).not.toContain('bitbucket');
  });

  it('returns every item unranked for an empty query', () => {
    expect(fuzzyRank('', ['a', 'b'], (s) => s)).toHaveLength(2);
  });
});

describe('searchConfig / searchActions', () => {
  it('finds an action via its title and its alias surfaces', () => {
    expect(searchActions('Open GitHub', config).map((r) => r.action.id)).toContain('a1');
    expect(searchActions('gh', config).map((r) => r.action.id)).toContain('a1');
    expect(searchActions('GitHub', config).map((r) => r.action.id)).toContain('a1');
  });

  it('ranks an exact title match first', () => {
    expect(searchActions('github', config)[0]?.action.id).toBe('a1');
  });

  it('deduplicates an action matched by multiple surfaces', () => {
    expect(searchActions('github', config).filter((r) => r.action.id === 'a1')).toHaveLength(1);
  });

  it('returns all actions for an empty query', () => {
    expect(searchActions('', config)).toHaveLength(config.actions.length);
  });

  it('includes workflows in config results', () => {
    const withWorkflow: Config = {
      ...config,
      workflows: [{ id: 'w1', name: 'Morning routine', steps: ['a1', 'a2'] }],
    };
    const items = searchConfig('morning', withWorkflow);
    expect(items.some((i) => i.kind === 'workflow' && i.id === 'w1')).toBe(true);
  });
});

describe('resolveQuery', () => {
  it('captures an argument for a parameterized alias keyword', () => {
    const resolved = resolveQuery('g hello world', config);
    expect(resolved.kind).toBe('argument');
    if (resolved.kind === 'argument') {
      expect(resolved.action.id).toBe('g');
      expect(resolved.keyword).toBe('g');
      expect(resolved.argument).toBe('hello world');
    }
  });

  it('falls back to results when the keyword is not parameterized', () => {
    // "gh" → GitHub action has no argument, so a trailing token is a plain search.
    expect(resolveQuery('gh stuff', config).kind).toBe('results');
  });

  it('returns results when there is no leading keyword+space', () => {
    expect(resolveQuery('goog', config).kind).toBe('results');
  });
});
