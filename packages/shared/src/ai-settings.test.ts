import { describe, it, expect } from 'vitest';
import { AI_TOOL_IDS, setAiToolGrant } from './ai-settings.js';

describe('AI_TOOL_IDS', () => {
  it('is the full tool catalog in canonical order', () => {
    expect(AI_TOOL_IDS).toEqual(['files', 'calendar', 'slack', 'slides-sheets', 'actions', 'apps']);
  });
});

describe('setAiToolGrant', () => {
  it('adds a missing grant in catalog order (not append order)', () => {
    // Granting "files" after "slack" must still sort before it.
    expect(setAiToolGrant(['slack'], 'files', true)).toEqual(['files', 'slack']);
  });

  it('removes a grant', () => {
    expect(setAiToolGrant(['files', 'calendar', 'slack'], 'calendar', false)).toEqual([
      'files',
      'slack',
    ]);
  });

  it('enabling is idempotent (no duplicates)', () => {
    expect(setAiToolGrant(['files'], 'files', true)).toEqual(['files']);
  });

  it('disabling a tool that was never granted is a no-op', () => {
    expect(setAiToolGrant(['files'], 'slack', false)).toEqual(['files']);
  });

  it('returns a new array (does not mutate the input)', () => {
    const tools = ['files'] as const;
    const next = setAiToolGrant(tools, 'slack', true);
    expect(next).not.toBe(tools);
    expect(tools).toEqual(['files']);
  });
});
