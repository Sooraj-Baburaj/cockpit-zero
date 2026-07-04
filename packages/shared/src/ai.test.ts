import { describe, it, expect } from 'vitest';
import { AiSettingsSchema, AiToolIdSchema } from './schemas.js';
import { defaultConfig, safeValidateConfig } from './config.js';

describe('AiSettingsSchema', () => {
  it('fills sensible defaults from an empty object', () => {
    const ai = AiSettingsSchema.parse({});
    expect(ai).toEqual({
      enabled: true,
      provider: 'mock',
      model: '',
      modelTier: 'pro',
      askFromBar: true,
      memoryEnabled: true,
      embeddingSource: 'local',
      // Cloud memory sync (production phase 8) is opt-in — off by default.
      memorySync: false,
      tools: ['files', 'calendar', 'slack'],
      // Bounded-cost knobs for the real agent loop (production phase 6).
      maxSteps: 12,
      maxToolCalls: 16,
      maxTokens: 120_000,
    });
  });

  it('bounds the agent-loop caps (positive integers, capped)', () => {
    expect(AiSettingsSchema.safeParse({ maxSteps: 0 }).success).toBe(false);
    expect(AiSettingsSchema.safeParse({ maxSteps: 999 }).success).toBe(false); // over the max
    expect(AiSettingsSchema.safeParse({ maxToolCalls: -1 }).success).toBe(false);
    expect(
      AiSettingsSchema.parse({ maxSteps: 6, maxToolCalls: 8, maxTokens: 50_000 }),
    ).toMatchObject({
      maxSteps: 6,
      maxToolCalls: 8,
      maxTokens: 50_000,
    });
  });

  it('validates the tool catalog', () => {
    expect(AiToolIdSchema.safeParse('files').success).toBe(true);
    expect(AiToolIdSchema.safeParse('nope').success).toBe(false);
  });

  it('accepts every real BYOP provider but rejects an unknown one', () => {
    // Production phase 3 expanded the enum from mock/anthropic to the real set.
    expect(AiSettingsSchema.safeParse({ provider: 'openai' }).success).toBe(true);
    expect(AiSettingsSchema.safeParse({ provider: 'openai-compatible' }).success).toBe(true);
    expect(AiSettingsSchema.safeParse({ provider: 'not-a-provider' }).success).toBe(false);
  });

  it('accepts an openai-compatible base URL and a free-text model', () => {
    const ai = AiSettingsSchema.parse({
      provider: 'openai-compatible',
      model: 'llama3.2',
      baseUrl: 'http://localhost:11434/v1',
    });
    expect(ai.baseUrl).toBe('http://localhost:11434/v1');
    expect(ai.model).toBe('llama3.2');
    // A malformed base URL is rejected by the schema.
    expect(AiSettingsSchema.safeParse({ baseUrl: 'not a url' }).success).toBe(false);
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
