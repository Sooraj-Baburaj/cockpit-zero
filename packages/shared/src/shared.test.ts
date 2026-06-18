import { describe, it, expect } from 'vitest';
import { defaultConfig, validateConfig, safeValidateConfig } from './config.js';
import { fuzzyMatch, searchActions, slugify } from './utils.js';
import type { Action } from './types.js';

describe('config', () => {
  it('produces a valid default config', () => {
    const cfg = defaultConfig();
    expect(() => validateConfig(cfg)).not.toThrow();
    expect(cfg.version).toBe(1);
    expect(cfg.settings.hotkey).toBe('CommandOrControl+Shift+Space');
  });

  it('rejects malformed config', () => {
    const result = safeValidateConfig({ version: 99 });
    expect(result.success).toBe(false);
  });
});

describe('slugify', () => {
  it('normalizes text', () => {
    expect(slugify('  Open GitHub! ')).toBe('open-github');
  });
});

describe('fuzzyMatch', () => {
  it('matches subsequences and scores consecutive runs higher', () => {
    expect(fuzzyMatch('gh', 'GitHub')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'GitHub')).toBeNull();
    const close = fuzzyMatch('git', 'GitHub')!;
    const spread = fuzzyMatch('gtb', 'GitHub')!;
    expect(close.score).toBeGreaterThan(spread.score);
  });
});

describe('searchActions', () => {
  const actions: Action[] = [
    { id: 'a1', title: 'Open GitHub', type: 'open-url', url: 'https://github.com' },
    { id: 'a2', title: 'Open Gmail', type: 'open-url', url: 'https://mail.google.com' },
  ];

  it('ranks results by score', () => {
    const results = searchActions('github', actions);
    expect(results[0]?.action.id).toBe('a1');
  });

  it('returns all actions for empty query', () => {
    expect(searchActions('', actions)).toHaveLength(2);
  });
});
