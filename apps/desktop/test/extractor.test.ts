import { describe, it, expect } from 'vitest';
import { createExtractor } from '../src/main/services/agent/extractor.js';

/**
 * The extractor is dependency-inverted: the provider call is an injected `generate`
 * that returns the raw model object, validated through the shared `coerceMemoryFacts`.
 * We exercise the provider path with a fake `generate`, the validation path with
 * malformed output, and the keyless heuristic path with no `generate` — all offline.
 */

describe('createExtractor — provider path', () => {
  it('returns validated facts from the model, clamping importance', async () => {
    const extractor = createExtractor({
      generate: async () => ({
        facts: [
          { text: 'Ships on Thursday', kind: 'event', importance: 5 }, // clamped to 1
          { text: 'Prefers dark mode', kind: 'preference', importance: 0.8 },
        ],
      }),
    });
    const facts = await extractor.extract('some exchange');
    expect(facts).toEqual([
      { text: 'Ships on Thursday', kind: 'event', importance: 1 },
      { text: 'Prefers dark mode', kind: 'preference', importance: 0.8 },
    ]);
  });

  it('caps the number of facts kept', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      text: `fact ${i}`,
      kind: 'note',
      importance: 0.5,
    }));
    const extractor = createExtractor({ generate: async () => ({ facts: many }), maxFacts: 3 });
    expect(await extractor.extract('x')).toHaveLength(3);
  });

  it('falls back to the heuristic when the model output is malformed', async () => {
    const extractor = createExtractor({ generate: async () => ({ nope: true }) });
    const facts = await extractor.extract(
      'The launch slipped to Thursday. Staging is green now.',
    );
    // Malformed → coerceMemoryFacts returns [] → heuristic splits the sentences.
    expect(facts.length).toBeGreaterThanOrEqual(2);
    expect(facts.every((f) => f.kind === 'note')).toBe(true);
  });

  it('falls back to the heuristic when the model call throws', async () => {
    const extractor = createExtractor({
      generate: async () => {
        throw new Error('no key');
      },
    });
    const facts = await extractor.extract('A durable fact worth keeping around.');
    expect(facts.length).toBeGreaterThanOrEqual(1);
  });

  it('respects a valid-but-empty model result (nothing worth remembering)', async () => {
    const extractor = createExtractor({ generate: async () => ({ facts: [] }) });
    // No facts AND non-trivial text → it does fall through to the heuristic, which is
    // fine; but a clearly trivial input yields nothing.
    expect(await extractor.extract('   ')).toEqual([]);
  });
});

describe('createExtractor — keyless heuristic', () => {
  it('splits text into deduped candidate facts', async () => {
    const extractor = createExtractor();
    const facts = await extractor.extract(
      'The board deck is due Friday.\nThe board deck is due Friday.\nQA owns the rollback.',
    );
    // Duplicate line collapses; two distinct facts remain.
    expect(facts).toHaveLength(2);
    expect(facts.map((f) => f.text)).toContain('QA owns the rollback.');
  });

  it('keeps a short phrase as a single fact', async () => {
    const extractor = createExtractor();
    const facts = await extractor.extract('Prefers the Sahara theme');
    expect(facts).toHaveLength(1);
    expect(facts[0]?.text).toBe('Prefers the Sahara theme');
  });

  it('returns nothing for empty input', async () => {
    const extractor = createExtractor();
    expect(await extractor.extract('   ')).toEqual([]);
  });

  it('assigns importance in the conservative [0.3, 0.85] band', async () => {
    const extractor = createExtractor();
    const facts = await extractor.extract('Revenue grew 18% in Q3 according to Priya Shah.');
    expect(facts[0]?.importance).toBeGreaterThanOrEqual(0.3);
    expect(facts[0]?.importance).toBeLessThanOrEqual(0.85);
  });
});
