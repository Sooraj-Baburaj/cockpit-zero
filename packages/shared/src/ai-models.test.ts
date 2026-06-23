import { describe, it, expect } from 'vitest';
import {
  AI_PROVIDER_IDS,
  MODEL_CATALOG,
  OPENAI_COMPATIBLE_PRESETS,
  PROVIDER_CATALOG,
  defaultModelFor,
  providerInfo,
  providerLabel,
} from './ai-models.js';

describe('model catalog', () => {
  it('has a (possibly empty) curated list for every provider id', () => {
    for (const id of AI_PROVIDER_IDS) {
      expect(Array.isArray(MODEL_CATALOG[id])).toBe(true);
      for (const m of MODEL_CATALOG[id]) {
        expect(m.id).toBeTruthy();
        expect(m.label).toBeTruthy();
      }
    }
  });

  it('defaultModelFor returns the first curated id, or "" when there is no catalog', () => {
    expect(defaultModelFor('anthropic')).toBe(MODEL_CATALOG.anthropic[0]?.id);
    expect(defaultModelFor('anthropic')).not.toBe('');
    expect(defaultModelFor('openai-compatible')).toBe('');
    expect(defaultModelFor('managed')).toBe('');
    expect(defaultModelFor('mock')).toBe('');
  });

  it('uses the Claude ids from the claude-api skill for anthropic', () => {
    const ids = MODEL_CATALOG.anthropic.map((m) => m.id);
    expect(ids).toContain('claude-opus-4-8');
    expect(ids.every((id) => id.startsWith('claude-'))).toBe(true);
  });
});

describe('provider catalog', () => {
  it('only lists real provider ids (no mock/managed in the BYOP picker)', () => {
    for (const p of PROVIDER_CATALOG) {
      expect(AI_PROVIDER_IDS).toContain(p.id);
    }
    const ids = PROVIDER_CATALOG.map((p) => p.id);
    expect(ids).not.toContain('mock');
    expect(ids).not.toContain('managed');
  });

  it('marks openai-compatible as base-URL-required + key-optional, others as key-required', () => {
    const compat = providerInfo('openai-compatible');
    expect(compat).toMatchObject({ requiresBaseUrl: true, requiresKey: false });

    const anthropic = providerInfo('anthropic');
    expect(anthropic).toMatchObject({ requiresBaseUrl: false, requiresKey: true });
  });

  it('providerLabel falls back to the raw id for non-catalog providers', () => {
    expect(providerLabel('anthropic')).toBe('Claude (Anthropic)');
    expect(providerLabel('mock')).toBe('mock');
  });
});

describe('openai-compatible presets', () => {
  it('every preset has a label and the local one needs no key; custom is blank', () => {
    const ollama = OPENAI_COMPATIBLE_PRESETS.find((p) => p.id === 'ollama');
    expect(ollama?.requiresKey).toBe(false);
    expect(ollama?.baseUrl).toMatch(/^https?:\/\//);

    const custom = OPENAI_COMPATIBLE_PRESETS.find((p) => p.id === 'custom');
    expect(custom?.baseUrl).toBe('');

    for (const preset of OPENAI_COMPATIBLE_PRESETS) {
      expect(preset.label).toBeTruthy();
      if (preset.id !== 'custom') expect(preset.baseUrl).toMatch(/^https?:\/\//);
    }
  });
});
