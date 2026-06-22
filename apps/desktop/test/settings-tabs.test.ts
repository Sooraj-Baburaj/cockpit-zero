import { describe, it, expect } from 'vitest';
import {
  INITIAL_SETTINGS_TAB,
  SETTINGS_TABS,
} from '../src/renderer/screens/settings-tabs.js';

describe('settings tabs', () => {
  it('registers the AI tab', () => {
    expect(SETTINGS_TABS).toContain('ai');
  });

  it('places AI second (after the default actions tab)', () => {
    expect(SETTINGS_TABS[1]).toBe('ai');
  });

  it('opens on a tab that exists', () => {
    expect(SETTINGS_TABS).toContain(INITIAL_SETTINGS_TAB);
  });

  it('omits not-yet-built tabs (routines / scripts)', () => {
    expect(SETTINGS_TABS).not.toContain('routines');
    expect(SETTINGS_TABS).not.toContain('scripts');
  });
});
