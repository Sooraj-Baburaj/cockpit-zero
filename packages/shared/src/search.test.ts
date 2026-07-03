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
      arguments: [{ name: 'query', placeholder: 'search terms', required: true }],
    },
    {
      id: 'repo',
      title: 'Open repo',
      type: 'open-url',
      url: 'https://github.com/{owner}/{repo}',
      arguments: [
        { name: 'owner', required: true },
        { name: 'repo', required: true },
      ],
    },
  ],
  aliases: [
    { id: 'al1', keyword: 'gh', label: 'GitHub', actionId: 'a1' },
    { id: 'al2', keyword: 'g', label: 'Google', actionId: 'g' },
    { id: 'al3', keyword: 'repo', label: 'Repo', actionId: 'repo' },
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

  it('tolerates a typo via the edit-distance fallback', () => {
    // "chrtme" is not a subsequence of "chrome" (no "t"), so fzf alone misses it.
    const matched = fuzzyRank('chrtme', ['Chrome', 'Firefox', 'Safari'], (s) => s).map(
      (r) => r.item,
    );
    expect(matched).toContain('Chrome');
    expect(matched).not.toContain('Safari');
  });

  it('matches a typo against one word of a multi-word title', () => {
    const matched = fuzzyRank('chrme', ['Google Chrome', 'Disk Utility'], (s) => s).map(
      (r) => r.item,
    );
    expect(matched).toContain('Google Chrome');
  });

  it('ranks exact subsequence matches ahead of typo matches', () => {
    const ranked = fuzzyRank('chrome', ['chrome', 'chrme'], (s) => s).map((r) => r.item);
    expect(ranked[0]).toBe('chrome');
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
  it('captures a single (greedy) argument for a parameterized alias keyword', () => {
    const resolved = resolveQuery('g hello world', config);
    expect(resolved.kind).toBe('argument');
    if (resolved.kind === 'argument') {
      expect(resolved.action.id).toBe('g');
      expect(resolved.keyword).toBe('g');
      expect(resolved.values).toEqual(['hello world']);
      expect(resolved.activeIndex).toBe(0);
    }
  });

  it('captures multiple positional arguments, last one greedy', () => {
    const resolved = resolveQuery('repo anthropic claude code', config);
    expect(resolved.kind).toBe('argument');
    if (resolved.kind === 'argument') {
      expect(resolved.values).toEqual(['anthropic', 'claude code']);
      expect(resolved.activeIndex).toBe(1);
    }
  });

  it('advances the active parameter when the current word ends with a space', () => {
    const resolved = resolveQuery('repo anthropic ', config);
    expect(resolved.kind).toBe('argument');
    if (resolved.kind === 'argument') {
      expect(resolved.values).toEqual(['anthropic', '']);
      expect(resolved.activeIndex).toBe(1);
    }
  });

  it('keeps the caret on the first parameter until a space is typed', () => {
    const resolved = resolveQuery('repo anth', config);
    expect(resolved.kind).toBe('argument');
    if (resolved.kind === 'argument') {
      expect(resolved.values).toEqual(['anth', '']);
      expect(resolved.activeIndex).toBe(0);
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
