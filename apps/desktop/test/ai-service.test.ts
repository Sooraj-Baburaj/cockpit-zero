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
import type { MemoryService } from '../src/main/services/agent/memory-service.js';
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
    askStream: vi.fn(
      async (
        prompt: string,
        _ctx,
        onDelta: (text: string) => void,
        signal?: AbortSignal,
      ) => {
        // Emit two ordered deltas (the id prefix, then the prompt), honouring abort.
        for (const chunk of [`${id}:`, prompt]) {
          if (signal?.aborted) break;
          onDelta(chunk);
        }
        return { text: `${id}:${prompt}`, suggestions: [] };
      },
    ),
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

  it('streams deltas then resolves the answer from the selected provider', async () => {
    const p = providers();
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    const deltas: string[] = [];
    const answer = await svc.askStream('hello', (t) => deltas.push(t));
    expect(deltas).toEqual(['openai:', 'hello']);
    expect(answer.text).toBe('openai:hello');
    expect(p.openai.askStream).toHaveBeenCalledOnce();
    expect(p.anthropic.askStream).not.toHaveBeenCalled();
  });

  it('stops emitting when the signal is already aborted', async () => {
    const p = providers();
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    const controller = new AbortController();
    controller.abort();
    const deltas: string[] = [];
    await svc.askStream('hello', (t) => deltas.push(t), controller.signal);
    expect(deltas).toEqual([]);
  });

  it('streams the disabled answer with no deltas when AI is off', async () => {
    const p = providers();
    const svc = createAiService({ providers: p, getConfig: () => configWith({ enabled: false }) });
    const deltas: string[] = [];
    const answer = await svc.askStream('hello', (t) => deltas.push(t));
    expect(deltas).toEqual([]);
    expect(answer.text).toMatch(/turned off/i);
    expect(p.mock.askStream).not.toHaveBeenCalled();
  });

  it('streams the connect nudge with no deltas when the provider is unconfigured', async () => {
    const p = providers({ openai: fakeProvider('openai', false) });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
    });
    const deltas: string[] = [];
    const answer = await svc.askStream('hello', (t) => deltas.push(t));
    expect(deltas).toEqual([]);
    expect(answer.text).toMatch(/connect/i);
    expect(p.openai.askStream).not.toHaveBeenCalled();
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

/** A fake memory engine: `recall` returns the given facts, `remember` records its
 *  input so we can assert the exchange was saved. */
function fakeMemory(opts: { enabled?: boolean; hits?: string[] } = {}): MemoryService {
  return {
    enabled: () => opts.enabled ?? true,
    recall: vi.fn(async () =>
      (opts.hits ?? []).map((text, i) => ({
        id: `m${i}`,
        ts: 0,
        updatedAt: 0,
        kind: 'note',
        text,
        importance: 0.5,
        embedding: [],
      })),
    ),
    remember: vi.fn(async () => []),
    write: vi.fn(async () => null),
    search: vi.fn(async () => []),
    stats: vi.fn(async () => ({ count: 0, updatedAt: null, embeddingSource: 'local' })),
    forget: vi.fn(async () => ({ ok: true })),
    clear: vi.fn(async () => ({ ok: true })),
  };
}

describe('createAiService — memory', () => {
  it('injects recalled memory into the prompt and remembers the exchange', async () => {
    const p = providers();
    const memory = fakeMemory({ hits: ['Prefers dark mode'] });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
      memory,
    });

    await svc.ask('what theme should I use');

    // The provider saw the prompt with a recalled-memory block prepended.
    const sentPrompt = (p.openai.ask as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(sentPrompt).toContain('Prefers dark mode');
    expect(sentPrompt).toContain('what theme should I use');
    // The exchange was remembered afterward (fire-and-forget, invoked synchronously).
    expect(memory.remember).toHaveBeenCalledOnce();
  });

  it('skips recall and remember when memory is disabled (provider gets the raw prompt)', async () => {
    const p = providers();
    const memory = fakeMemory({ enabled: false, hits: ['ignored'] });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
      memory,
    });

    await svc.ask('hello');

    expect(memory.recall).not.toHaveBeenCalled();
    expect(memory.remember).not.toHaveBeenCalled();
    expect((p.openai.ask as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('hello');
  });

  it('injects memory into the streamed path too', async () => {
    const p = providers();
    const memory = fakeMemory({ hits: ['Lives in Berlin'] });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
      memory,
    });

    await svc.askStream('where am I', () => {});

    const sentPrompt = (p.openai.askStream as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(sentPrompt).toContain('Lives in Berlin');
    expect(memory.remember).toHaveBeenCalledOnce();
  });

  it('does not recall/remember when the provider is unconfigured', async () => {
    const p = providers({ openai: fakeProvider('openai', false) });
    const memory = fakeMemory({ hits: ['x'] });
    const svc = createAiService({
      providers: p,
      getConfig: () => configWith({ provider: 'openai' }),
      memory,
    });

    await svc.ask('hello');

    expect(memory.recall).not.toHaveBeenCalled();
    expect(memory.remember).not.toHaveBeenCalled();
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

  it('streams the canned answer as ordered deltas that reconstruct its text', async () => {
    const provider = createMockProvider();
    const deltas: string[] = [];
    const answer = await provider.askStream(
      'summarize the thread',
      { settings: defaultConfig().ai },
      (t) => deltas.push(t),
    );
    // Several chunks (so the UI animates), and concatenating them is the full text.
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join('')).toBe(answer.text);
    expect(answer.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('stops streaming promptly once the signal aborts', async () => {
    const provider = createMockProvider();
    const controller = new AbortController();
    controller.abort();
    const deltas: string[] = [];
    await provider.askStream('anything', { settings: defaultConfig().ai }, (t) => deltas.push(t), controller.signal);
    expect(deltas).toEqual([]);
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
