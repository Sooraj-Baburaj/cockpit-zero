import { describe, it, expect } from 'vitest';
import { defaultConfig, validateConfig, safeValidateConfig } from './config.js';
import { slugify, createId } from './utils.js';

describe('config', () => {
  it('produces a valid default config', () => {
    const cfg = defaultConfig();
    expect(() => validateConfig(cfg)).not.toThrow();
    expect(cfg.version).toBe(1);
    expect(cfg.settings.hotkey).toBe('CommandOrControl+J');
  });

  it('defaults appearance to monochrome with launcher translucency on', () => {
    const cfg = defaultConfig();
    expect(cfg.settings.monochrome).toBe(true);
    expect(cfg.settings.sidebarAccent).toBe(false);
    expect(cfg.settings.glass).toBe(true);
  });

  it('rejects malformed config', () => {
    expect(safeValidateConfig({ version: 99 }).success).toBe(false);
  });

  it('accepts templated URLs in actions', () => {
    const result = safeValidateConfig({
      ...defaultConfig(),
      actions: [
        {
          id: 'a1',
          title: 'npm package',
          type: 'open-url',
          url: 'https://www.npmjs.com/package/{query}',
          arguments: [{ name: 'query' }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('utils', () => {
  it('slugifies text', () => {
    expect(slugify('  Open GitHub! ')).toBe('open-github');
  });

  it('creates prefixed ids', () => {
    expect(createId('act')).toMatch(/^act_/);
  });
});
