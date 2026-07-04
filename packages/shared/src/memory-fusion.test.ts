import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  createHashEmbedder,
  fuseHybridChannels,
  fuseRankedLists,
  l2normalize,
  rankWithTies,
  terms,
} from './memory-fusion.js';

const entry = (id: string, updatedAt = 0, importance = 0.5) => ({ id, updatedAt, importance });

describe('vector math', () => {
  it('cosineSimilarity handles identical, orthogonal, and zero vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('l2normalize produces unit vectors and copies zero vectors', () => {
    const v = l2normalize([3, 4]);
    expect(v).toEqual([0.6, 0.8]);
    expect(l2normalize([0, 0])).toEqual([0, 0]);
  });

  it('terms lowercases, dedupes, and drops single characters', () => {
    expect(terms('The Q3 deck — the DECK!')).toEqual(['the', 'q3', 'deck']);
  });

  it('hash embedder is deterministic and dimension-stable', async () => {
    const embedder = createHashEmbedder(64);
    const [a, b] = await embedder.embed(['quarterly deck', 'quarterly deck']);
    expect(a).toEqual(b);
    expect(a).toHaveLength(64);
    expect(cosineSimilarity(a!, b!)).toBeCloseTo(1);
  });
});

describe('rankWithTies', () => {
  it('assigns dense ranks with equal scores sharing a rank', () => {
    const ranks = rankWithTies([
      { id: 'a', score: 3 },
      { id: 'b', score: 3 },
      { id: 'c', score: 1 },
    ]);
    expect(ranks.get('a')).toBe(0);
    expect(ranks.get('b')).toBe(0);
    expect(ranks.get('c')).toBe(2);
  });
});

describe('fuseHybridChannels', () => {
  it('an entry matched by both channels outranks single-channel entries', () => {
    const entries = [entry('both'), entry('semantic-only'), entry('keyword-only')];
    const fused = fuseHybridChannels({
      entries,
      semantic: [
        { id: 'semantic-only', score: 0.9 },
        { id: 'both', score: 0.8 },
      ],
      keyword: [
        { id: 'keyword-only', score: 2 },
        { id: 'both', score: 1 },
      ],
      limit: 3,
    });
    expect(fused[0]?.id).toBe('both');
  });

  it('recency breaks ties between equally-scored entries', () => {
    const entries = [entry('old', 1_000), entry('new', 2_000)];
    const fused = fuseHybridChannels({
      entries,
      semantic: [
        { id: 'old', score: 0.5 },
        { id: 'new', score: 0.5 },
      ],
      keyword: [],
      limit: 2,
    });
    expect(fused.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('excludes entries in neither channel and respects the limit', () => {
    const entries = [entry('a'), entry('b'), entry('unmatched')];
    const fused = fuseHybridChannels({
      entries,
      semantic: [{ id: 'a', score: 0.9 }],
      keyword: [{ id: 'b', score: 1 }],
      limit: 1,
    });
    expect(fused).toHaveLength(1);
    expect(fused.map((e) => e.id)).not.toContain('unmatched');
  });

  it('ignores channel hits whose entries are not in the candidate pool', () => {
    const fused = fuseHybridChannels({
      entries: [entry('known')],
      semantic: [
        { id: 'ghost', score: 1 },
        { id: 'known', score: 0.5 },
      ],
      keyword: [],
      limit: 5,
    });
    expect(fused.map((e) => e.id)).toEqual(['known']);
  });
});

describe('fuseRankedLists', () => {
  it('dedupes by key, keeping the first list’s item', () => {
    const local = [{ id: 'shared', origin: 'local' }];
    const cloud = [
      { id: 'shared', origin: 'cloud' },
      { id: 'cloud-only', origin: 'cloud' },
    ];
    const fused = fuseRankedLists([local, cloud], (i) => i.id, 10);
    expect(fused.find((i) => i.id === 'shared')?.origin).toBe('local');
    expect(fused.map((i) => i.id)).toContain('cloud-only');
  });

  it('an item ranked in two lists beats a single-list top item', () => {
    const a = [{ id: 'x' }, { id: 'both' }];
    const b = [{ id: 'y' }, { id: 'both' }];
    const fused = fuseRankedLists([a, b], (i) => i.id, 10);
    expect(fused[0]?.id).toBe('both');
  });

  it('respects the limit', () => {
    const fused = fuseRankedLists([[{ id: 'a' }, { id: 'b' }, { id: 'c' }]], (i) => i.id, 2);
    expect(fused).toHaveLength(2);
  });
});
