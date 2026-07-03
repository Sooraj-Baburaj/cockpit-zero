import { describe, it, expect, vi } from 'vitest';
import {
  AiWorkflowPlanSchema,
  defaultConfig,
  rankDigestItems,
  type AiSettings,
  type DigestSourceItem,
} from '@cockpitzero/shared';
import { createSdkProvider, type SdkProviderDeps } from '../src/main/infra/ai/sdk-provider.js';

/**
 * The SDK provider is dependency-inverted: the AI-SDK entry points and the vault
 * `getKey` are injected, so we exercise provider→model mapping, key wiring, and
 * output mapping with fakes — no network, no electron (CLAUDE.md test rule).
 */
function settings(over: Partial<AiSettings>): AiSettings {
  return { ...defaultConfig().ai, ...over };
}

const DIGEST_OPTS = { rankBy: 'importance' as const, modelTier: 'mini' as const, maxItems: 8 };
const ITEMS: DigestSourceItem[] = [
  { id: 'a', who: 'Priya', source: 'slack', text: 'needs the rollback plan now', ageMinutes: 3 },
];

/** A model sentinel `createModel` returns so we can assert what got passed to generate. */
function fakeModel(s: AiSettings, key: string | null) {
  return { sentinel: s.provider, model: s.model, key };
}
const asCreateModel = fakeModel as unknown as SdkProviderDeps['createModel'];
const asGenerate = <T>(fn: T) =>
  fn as unknown as SdkProviderDeps['generateText'] & SdkProviderDeps['generateObject'];

describe('createSdkProvider', () => {
  it('maps a generateText result to an AiAnswer with a real-usage meta line', async () => {
    let passedModel: unknown;
    const generateText = vi.fn(async (opts: { model: unknown }) => {
      passedModel = opts.model;
      return {
        text: '  Launch slipped to Thursday.  ',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
    });
    const createModel = vi.fn(fakeModel);
    const getKey = vi.fn(() => 'sk-test');
    const provider = createSdkProvider({
      getKey,
      createModel: createModel as unknown as SdkProviderDeps['createModel'],
      generateText: asGenerate(generateText),
      generateObject: asGenerate(vi.fn()),
    });

    const answer = await provider.ask('what changed?', {
      settings: settings({ provider: 'anthropic', model: 'claude-opus-4-8' }),
    });

    expect(answer.text).toBe('Launch slipped to Thursday.');
    expect(answer.suggestions).toEqual([]);
    expect(answer.meta).toContain('claude-opus-4-8');
    expect(answer.meta).toContain('15 tok');
    // Key read from the vault for the selected provider, passed into the model factory.
    expect(getKey).toHaveBeenCalledWith('anthropic');
    expect(createModel).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'claude-opus-4-8' }),
      'sk-test',
    );
    // The model the factory produced is the one handed to generateText.
    expect(passedModel).toEqual({
      sentinel: 'anthropic',
      model: 'claude-opus-4-8',
      key: 'sk-test',
    });
  });

  it('streams text deltas and finalizes an AiAnswer with a real-usage meta line', async () => {
    let passedModel: unknown;
    const streamText = vi.fn((opts: { model: unknown }) => {
      passedModel = opts.model;
      return {
        // The SDK exposes deltas as an async-iterable and the aggregate text/usage
        // as promises that settle when the stream ends.
        textStream: (async function* () {
          yield 'Launch ';
          yield 'slipped to Thursday.  ';
        })(),
        text: Promise.resolve('  Launch slipped to Thursday.  '),
        usage: Promise.resolve({ inputTokens: 8, outputTokens: 4, totalTokens: 12 }),
      };
    });
    const provider = createSdkProvider({
      getKey: () => 'sk-test',
      createModel: asCreateModel,
      generateText: asGenerate(vi.fn()),
      generateObject: asGenerate(vi.fn()),
      streamText: streamText as unknown as SdkProviderDeps['streamText'],
    });

    const deltas: string[] = [];
    const answer = await provider.askStream(
      'what changed?',
      { settings: settings({ provider: 'anthropic', model: 'claude-opus-4-8' }) },
      (t) => deltas.push(t),
    );

    // Deltas arrive verbatim in order; the finalized answer is the trimmed aggregate.
    expect(deltas).toEqual(['Launch ', 'slipped to Thursday.  ']);
    expect(answer.text).toBe('Launch slipped to Thursday.');
    expect(answer.suggestions).toEqual([]);
    expect(answer.meta).toContain('claude-opus-4-8');
    expect(answer.meta).toContain('12 tok');
    expect(passedModel).toEqual({
      sentinel: 'anthropic',
      model: 'claude-opus-4-8',
      key: 'sk-test',
    });
  });

  it('passes the abort signal through to streamText', async () => {
    const controller = new AbortController();
    let passedSignal: unknown;
    const streamText = vi.fn((opts: { abortSignal?: unknown }) => {
      passedSignal = opts.abortSignal;
      return {
        textStream: (async function* () {})(),
        text: Promise.resolve('ok'),
        usage: Promise.resolve({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }),
      };
    });
    const provider = createSdkProvider({
      getKey: () => 'k',
      createModel: asCreateModel,
      generateText: asGenerate(vi.fn()),
      generateObject: asGenerate(vi.fn()),
      streamText: streamText as unknown as SdkProviderDeps['streamText'],
    });

    await provider.askStream(
      'q',
      { settings: settings({ provider: 'openai', model: 'gpt-5' }) },
      () => {},
      controller.signal,
    );
    expect(passedSignal).toBe(controller.signal);
  });

  it('drafts a workflow via generateObject against the plan schema, mapped + validated', async () => {
    const plan = {
      name: 'Morning',
      keyword: 'morning',
      steps: [
        { title: 'Open dashboard', kind: 'open-url', target: 'https://linear.app' },
        { title: 'Start timer', kind: 'run-command', target: 'timer start --minutes 50' },
        { title: 'Note', kind: 'open-url', target: 'just some prose, not a url' },
      ],
    };
    let passedSchema: unknown;
    const generateObject = vi.fn(async (opts: { schema: unknown }) => {
      passedSchema = opts.schema;
      return { object: plan };
    });
    const provider = createSdkProvider({
      getKey: () => 'k',
      createModel: asCreateModel,
      generateText: asGenerate(vi.fn()),
      generateObject: asGenerate(generateObject),
    });

    const draft = await provider.draftWorkflow('open my morning stuff', {
      settings: settings({ provider: 'openai', model: 'gpt-5' }),
    });

    // generateObject was asked for the plan schema (not the complex WorkflowDraftSchema).
    expect(passedSchema).toBe(AiWorkflowPlanSchema);
    expect(draft.name).toBe('Morning');
    expect(draft.steps[0]?.action).toMatchObject({ type: 'open-url', url: 'https://linear.app' });
    expect(draft.steps[1]?.action).toMatchObject({ type: 'run-command', command: 'timer' });
    // A non-URL "open-url" target degrades to a snippet so the draft still validates.
    expect(draft.steps[2]?.action).toMatchObject({ type: 'snippet' });
  });

  it('summarizes a digest via generateObject, reconciled against the input items', async () => {
    const generateObject = vi.fn(async () => ({
      object: { items: [{ id: 'a', summary: 'Rollback plan needed', bucket: 'now', score: 0.95 }] },
    }));
    const provider = createSdkProvider({
      getKey: () => 'k',
      createModel: asCreateModel,
      generateText: asGenerate(vi.fn()),
      generateObject: asGenerate(generateObject),
    });

    const rankings = await provider.summarizeDigest(ITEMS, DIGEST_OPTS, {
      settings: settings({ provider: 'openai', model: 'gpt-5' }),
    });
    expect(rankings).toEqual([
      { id: 'a', summary: 'Rollback plan needed', bucket: 'now', score: 0.95 },
    ]);
  });

  it('falls back to the deterministic ranker when structured output throws', async () => {
    const provider = createSdkProvider({
      getKey: () => 'k',
      createModel: asCreateModel,
      generateText: asGenerate(vi.fn()),
      generateObject: asGenerate(
        vi.fn(async () => {
          throw new Error('provider does not support structured output');
        }),
      ),
    });

    const rankings = await provider.summarizeDigest(ITEMS, DIGEST_OPTS, {
      settings: settings({ provider: 'cohere', model: 'command-r-plus' }),
    });
    expect(rankings).toEqual(rankDigestItems(ITEMS, DIGEST_OPTS));
  });

  describe('ready()', () => {
    it('requires a model id', () => {
      const provider = createSdkProvider({ getKey: () => 'k' });
      expect(provider.ready({ settings: settings({ provider: 'anthropic', model: '' }) })).toBe(
        false,
      );
      expect(
        provider.ready({ settings: settings({ provider: 'anthropic', model: 'claude-opus-4-8' }) }),
      ).toBe(true);
    });

    it('requires a vault key for hosted providers', () => {
      const provider = createSdkProvider({ getKey: () => null });
      expect(
        provider.ready({ settings: settings({ provider: 'anthropic', model: 'claude-opus-4-8' }) }),
      ).toBe(false);
    });

    it('requires a base URL but not a key for openai-compatible (e.g. local Ollama)', () => {
      const provider = createSdkProvider({ getKey: () => null });
      expect(
        provider.ready({
          settings: settings({ provider: 'openai-compatible', model: 'llama3.2' }),
        }),
      ).toBe(false);
      expect(
        provider.ready({
          settings: settings({
            provider: 'openai-compatible',
            model: 'llama3.2',
            baseUrl: 'http://localhost:11434/v1',
          }),
        }),
      ).toBe(true);
    });
  });
});
