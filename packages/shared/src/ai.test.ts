import { describe, it, expect } from 'vitest';
import { AiSettingsSchema, AiToolIdSchema } from './schemas.js';
import { defaultConfig, safeValidateConfig } from './config.js';

describe('AiSettingsSchema', () => {
  it('fills sensible defaults from an empty object', () => {
    const ai = AiSettingsSchema.parse({});
    expect(ai).toEqual({
      enabled: true,
      provider: 'mock',
      modelTier: 'pro',
      askFromBar: true,
      memoryEnabled: true,
      tools: ['files', 'calendar', 'slack'],
    });
  });

  it('validates the tool catalog', () => {
    expect(AiToolIdSchema.safeParse('files').success).toBe(true);
    expect(AiToolIdSchema.safeParse('nope').success).toBe(false);
  });

  it('rejects an unknown provider', () => {
    expect(AiSettingsSchema.safeParse({ provider: 'openai' }).success).toBe(false);
  });
});

describe('ConfigSchema with ai', () => {
  it('defaults the ai block into a fresh config', () => {
    expect(defaultConfig().ai.provider).toBe('mock');
  });

  it('parses an old config that predates the ai block (additive default)', () => {
    const legacy = {
      version: 1,
      settings: { hotkey: 'CommandOrControl+Shift+Space' },
      actions: [],
      aliases: [],
      workflows: [],
      // no `ai` key — must parse to the default block, not fail.
    };
    const result = safeValidateConfig(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ai.enabled).toBe(true);
      expect(result.data.ai.provider).toBe('mock');
    }
  });
});
