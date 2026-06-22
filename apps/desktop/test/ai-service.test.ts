import { describe, it, expect, vi } from 'vitest';
import { defaultConfig, type AiProviderId, type Config } from '@cockpitzero/shared';
import { createAiService } from '../src/main/services/ai/ai-service.js';
import type { AiProvider } from '../src/main/services/ai/provider.js';
import { createMockProvider } from '../src/main/infra/ai/mock-provider.js';

/**
 * The AI service is dependency-inverted (providers map + config reader), so we
 * exercise it with fakes here — no electron, mirroring action-runner.test.ts.
 */
function fakeProvider(id: string, ready = true): AiProvider {
  return {
    id,
    ready: vi.fn(() => ready),
    ask: vi.fn(async (prompt) => ({ text: `${id}:${prompt}`, suggestions: [] })),
    draftWorkflow: vi.fn(async (desc) => ({ name: `${id}:${desc}`, steps: [] })),
  };
}

function configWith(ai: Partial<Config['ai']>): Config {
  const base = defaultConfig();
  return { ...base, ai: { ...base.ai, ...ai } };
}

function providers(): Record<AiProviderId, AiProvider> {
  return { mock: fakeProvider('mock'), anthropic: fakeProvider('anthropic', false) };
}

describe('createAiService', () => {
  it('routes ask to the provider selected by config', async () => {
    const p = providers();
    const svc = createAiService({ providers: p, getConfig: () => configWith({ provider: 'mock' }) });
    const answer = await svc.ask('hello');
    expect(answer.text).toBe('mock:hello');
    expect(p.mock.ask).toHaveBeenCalledOnce();
    expect(p.anthropic.ask).not.toHaveBeenCalled();
  });

  it('selects a different provider when config changes', async () => {
    const p = providers();
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'anthropic' }),
    });
    await svc.ask('hi');
    expect(p.anthropic.ask).toHaveBeenCalledOnce();
    expect(p.mock.ask).not.toHaveBeenCalled();
  });

  it('short-circuits to a disabled answer without hitting a provider', async () => {
    const p = providers();
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ enabled: false }),
    });
    const answer = await svc.ask('hello');
    expect(answer.suggestions).toEqual([]);
    expect(answer.text).toMatch(/turned off/i);
    expect(p.mock.ask).not.toHaveBeenCalled();
  });

  it('reports status from enabled + provider readiness', () => {
    const p = providers();
    const enabled = createAiService({ providers: p, getConfig: () => configWith({ provider: 'mock' }) });
    expect(enabled.status()).toEqual({ enabled: true, provider: 'mock', ok: true });

    const unready = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'anthropic' }),
    });
    expect(unready.status()).toEqual({ enabled: true, provider: 'anthropic', ok: false });

    const off = createAiService({ providers: p, getConfig: () => configWith({ enabled: false }) });
    expect(off.status()).toEqual({ enabled: false, provider: 'mock', ok: false });
  });
});

describe('mock provider', () => {
  it('produces a prompt-dependent answer with at least one suggestion', async () => {
    const provider = createMockProvider();
    const answer = await provider.ask('summarize the thread', { settings: defaultConfig().ai });
    expect(answer.text).toContain('summarize the thread');
    expect(answer.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(provider.ready({ settings: defaultConfig().ai })).toBe(true);
  });
});
