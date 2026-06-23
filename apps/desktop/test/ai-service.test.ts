import { describe, it, expect, vi } from 'vitest';
import {
  AI_PROVIDER_IDS,
  WorkflowDraftSchema,
  defaultConfig,
  type AiProviderId,
  type Config,
  type DigestSourceItem,
} from '@cockpitzero/shared';
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
    draftWorkflow: vi.fn(async (desc) => ({ name: `${id}:${desc}`, keyword: '', steps: [] })),
    summarizeDigest: vi.fn(async (items: DigestSourceItem[]) =>
      items.map((it) => ({
        id: it.id,
        summary: `${id}:${it.text}`,
        bucket: 'wait' as const,
        score: 1,
      })),
    ),
  };
}

function configWith(ai: Partial<Config['ai']>): Config {
  const base = defaultConfig();
  return { ...base, ai: { ...base.ai, ...ai } };
}

/** A providers record total over the (now much larger) `AiProviderId` enum, with
 *  per-id overrides. The service indexes it by `config.ai.provider`. */
function providers(
  overrides: Partial<Record<AiProviderId, AiProvider>> = {},
): Record<AiProviderId, AiProvider> {
  const base = {} as Record<AiProviderId, AiProvider>;
  for (const id of AI_PROVIDER_IDS) base[id] = fakeProvider(id);
  return { ...base, ...overrides };
}

describe('createAiService', () => {
  it('routes ask to the provider selected by config', async () => {
    const p = providers();
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    const answer = await svc.ask('hello');
    expect(answer.text).toBe('openai:hello');
    expect(p.openai.ask).toHaveBeenCalledOnce();
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
    expect(p.openai.ask).not.toHaveBeenCalled();
  });

  it('short-circuits to a disabled answer without hitting a provider', async () => {
    const p = providers();
    const svc = createAiService({ providers: p, getConfig: () => configWith({ enabled: false }) });
    const answer = await svc.ask('hello');
    expect(answer.suggestions).toEqual([]);
    expect(answer.text).toMatch(/turned off/i);
    expect(p.mock.ask).not.toHaveBeenCalled();
  });

  it('nudges to connect when the selected provider is unconfigured (no fabricated answer)', async () => {
    const p = providers({ openai: fakeProvider('openai', false) });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    const answer = await svc.ask('hello');
    expect(answer.text).toMatch(/connect/i);
    expect(answer.suggestions).toEqual([]);
    expect(p.openai.ask).not.toHaveBeenCalled();
  });

  it('reports status from enabled + provider readiness', () => {
    const p = providers({ anthropic: fakeProvider('anthropic', false) });
    const ready = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    expect(ready.status()).toEqual({ enabled: true, provider: 'openai', ok: true });

    const unready = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'anthropic' }),
    });
    expect(unready.status()).toEqual({ enabled: true, provider: 'anthropic', ok: false });

    const off = createAiService({ providers: p, getConfig: () => configWith({ enabled: false }) });
    expect(off.status()).toEqual({ enabled: false, provider: 'mock', ok: false });
  });

  it('returns a schema-valid draft from the selected provider', async () => {
    const p = providers({ mock: createMockProvider() });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'mock' }),
    });
    const draft = await svc.draftWorkflow('every morning, open my dashboards');
    expect(WorkflowDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects invalid provider output (never hands unvalidated steps to the UI)', async () => {
    // The fake's draftWorkflow returns zero steps → must fail re-validation.
    const svc = createAiService({
      providers: providers({ openai: fakeProvider('openai') }),
      getConfig: () => configWith({ provider: 'openai' }),
    });
    await expect(svc.draftWorkflow('anything')).rejects.toThrow();
  });

  it('throws a connect nudge when drafting with an unconfigured provider', async () => {
    const p = providers({ openai: fakeProvider('openai', false) });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    await expect(svc.draftWorkflow('x')).rejects.toThrow(/connect/i);
    expect(p.openai.draftWorkflow).not.toHaveBeenCalled();
  });

  it('returns an empty draft when AI is disabled (no provider call)', async () => {
    const p = providers();
    const svc = createAiService({ providers: p, getConfig: () => configWith({ enabled: false }) });
    const draft = await svc.draftWorkflow('x');
    expect(draft).toEqual({ name: '', keyword: '', steps: [] });
    expect(p.mock.draftWorkflow).not.toHaveBeenCalled();
  });

  it('routes summarizeDigest to the selected provider', async () => {
    const p = providers();
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    const rankings = await svc.summarizeDigest(
      [{ id: 'x', who: 'A', source: 'slack', text: 'hello', ageMinutes: 1 }],
      { rankBy: 'importance', modelTier: 'mini', maxItems: 8 },
    );
    expect(rankings[0]).toMatchObject({ id: 'x', summary: 'openai:hello' });
    expect(p.openai.summarizeDigest).toHaveBeenCalledOnce();
  });

  it('falls back to the local ranker (no provider call) when AI is disabled', async () => {
    const p = providers();
    const svc = createAiService({ providers: p, getConfig: () => configWith({ enabled: false }) });
    const rankings = await svc.summarizeDigest(
      [{ id: 'x', who: 'A', source: 'slack', text: 'newsletter digest', ageMinutes: 1 }],
      { rankBy: 'importance', modelTier: 'mini', maxItems: 8 },
    );
    expect(rankings[0]).toMatchObject({ id: 'x', bucket: 'noise' });
    expect(p.mock.summarizeDigest).not.toHaveBeenCalled();
  });

  it('falls back to the local ranker when the selected provider is unconfigured', async () => {
    const p = providers({ openai: fakeProvider('openai', false) });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    const rankings = await svc.summarizeDigest(
      [{ id: 'x', who: 'A', source: 'slack', text: 'newsletter digest', ageMinutes: 1 }],
      { rankBy: 'importance', modelTier: 'mini', maxItems: 8 },
    );
    expect(rankings[0]).toMatchObject({ id: 'x', bucket: 'noise' });
    expect(p.openai.summarizeDigest).not.toHaveBeenCalled();
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

  it('drafts a schema-valid, plausible multi-step workflow (the canned sample)', async () => {
    const provider = createMockProvider();
    const draft = await provider.draftWorkflow('ignored', { settings: defaultConfig().ai });
    expect(WorkflowDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft.name).toBe('Morning routine');
    expect(draft.steps).toHaveLength(4);
    // Every step is materializable (carries an action or references an existing id).
    for (const step of draft.steps) expect(step.action ?? step.actionId).toBeTruthy();
  });
});
