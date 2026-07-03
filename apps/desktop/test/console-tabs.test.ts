import { describe, it, expect } from 'vitest';
import { INITIAL_CONSOLE_TAB, CONSOLE_TABS } from '../src/renderer/screens/console-tabs.js';

describe('console tabs', () => {
  it('registers the AI tab', () => {
    expect(CONSOLE_TABS).toContain('ai');
  });

  it('places AI second (after the default actions tab)', () => {
    expect(CONSOLE_TABS[1]).toBe('ai');
  });

  it('opens on a tab that exists', () => {
    expect(CONSOLE_TABS).toContain(INITIAL_CONSOLE_TAB);
  });

  it('registers the Routines tab (Phase 5)', () => {
    expect(CONSOLE_TABS).toContain('routines');
  });

  it('omits the still-out-of-scope scripts tab', () => {
    expect(CONSOLE_TABS).not.toContain('scripts');
  });
});
