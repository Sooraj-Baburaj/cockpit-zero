import { describe, it, expect } from 'vitest';
import { buildSearchIndex, resolveQuery, searchActions } from './search.js';
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

describe('buildSearchIndex', () => {
  it('indexes actions by title and alias surfaces', () => {
    const labels = buildSearchIndex(config).map((e) => e.label);
    expect(labels).toContain('Open GitHub');
    expect(labels).toContain('gh');
    expect(labels).toContain('GitHub');
  });
});

describe('searchActions', () => {
  it('ranks an exact title match first', () => {
    expect(searchActions('github', config)[0]?.action.id).toBe('a1');
  });

  it('matches actions via their alias keyword', () => {
    const ids = searchActions('gh', config).map((r) => r.action.id);
    expect(ids).toContain('a1');
  });

  it('deduplicates an action matched by multiple surfaces', () => {
    const results = searchActions('github', config);
    expect(results.filter((r) => r.action.id === 'a1')).toHaveLength(1);
  });

  it('returns all actions for an empty query', () => {
    expect(searchActions('', config)).toHaveLength(config.actions.length);
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
