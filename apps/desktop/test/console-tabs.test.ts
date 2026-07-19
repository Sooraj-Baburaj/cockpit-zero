import { describe, it, expect } from 'vitest';
import {
  INITIAL_CONSOLE_TAB,
  CONSOLE_TABS,
  CONSOLE_NAV_GROUPS,
} from '../src/renderer/screens/console-tabs.js';

describe('console tabs', () => {
  it('registers the AI tab', () => {
    expect(CONSOLE_TABS).toContain('ai');
  });

  it('opens on the actions tab, first in the Commands group', () => {
    expect(CONSOLE_TABS[0]).toBe('actions');
  });

  it('flattens the nav groups in display order', () => {
    expect(CONSOLE_TABS).toEqual(CONSOLE_NAV_GROUPS.flatMap((g) => [...g.tabs]));
  });

  it('has no tab in more than one group', () => {
    expect(new Set(CONSOLE_TABS).size).toBe(CONSOLE_TABS.length);
  });

  it('opens on a tab that exists', () => {
    expect(CONSOLE_TABS).toContain(INITIAL_CONSOLE_TAB);
  });

  it('registers the Routines tab (Phase 5)', () => {
    expect(CONSOLE_TABS).toContain('routines');
  });

  it('registers the Account tab (P7)', () => {
    expect(CONSOLE_TABS).toContain('account');
  });

  it('omits the never-built import/export tab (Config + sync cover it)', () => {
    expect(CONSOLE_TABS).not.toContain('importexport');
  });

  it('omits the still-out-of-scope scripts tab', () => {
    expect(CONSOLE_TABS).not.toContain('scripts');
  });
});
