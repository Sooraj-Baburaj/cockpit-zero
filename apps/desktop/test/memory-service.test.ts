import { describe, it, expect } from 'vitest';
import { defaultConfig, type Config } from '@cockpitzero/shared';
import {
  createMemoryService,
  createInMemoryMemoryStore,
} from '../src/main/services/agent/memory-service.js';
import type { Embedder } from '../src/main/services/agent/embedder.js';
import type { Extractor } from '../src/main/services/agent/extractor.js';

/**
 * The memory engine is dependency-inverted (a `MemoryStore` + `Embedder` +
 * `Extractor` + config reader), so we drive it with the real in-memory store and
 * hand-rigged fakes — no electron, no LanceDB, no transformers, no network. The
 * embedder maps specific texts to explicit vectors so we can prove the semantic
 * channel, dedup threshold, and RRF/recency fusion deterministically.
 */

/** An embedder backed by an explicit text → vector map (zero vector otherwise).
 *  Cosine is computed by the service, so unnormalized integer vectors are fine. */
function mapEmbedder(vectors: Record<string, number[]>, dim = 3): Embedder {
  return {
    dimensions: dim,
    async embed(texts) {
      return texts.map((t) => vectors[t] ?? new Array<number>(dim).fill(0));
    },
  };
}

/** A no-op extractor (the `remember` path is exercised separately in extractor.test). */
const noopExtractor: Extractor = { extract: async () => [] };

/** An extractor that returns a fixed fact list (to drive `remember`). */
function factExtractor(facts: { text: string; kind: string; importance: number }[]): Extractor {
  return { extract: async () => facts };
}

function configWith(memoryEnabled: boolean): Config {
  const base = defaultConfig();
  return { ...base, ai: { ...base.ai, memoryEnabled } };
}

function service(opts: {
  vectors?: Record<string, number[]>;
  enabled?: boolean;
  extractor?: Extractor;
  seedTime?: number;
}) {
  const store = createInMemoryMemoryStore();
  let t = opts.seedTime ?? 1_000;
  const svc = createMemoryService({
    store,
    embedder: mapEmbedder(opts.vectors ?? {}),
    extractor: opts.extractor ?? noopExtractor,
    getConfig: () => configWith(opts.enabled ?? true),
    now: () => (t += 1000),
    newId: () => `id_${t}`,
  });
  return { svc, store };
}

describe('memory engine — gating', () => {
  it('is a no-op when memory is disabled', async () => {
    const { svc, store } = service({ enabled: false });
    expect(svc.enabled()).toBe(false);
    expect(await svc.write('anything')).toBeNull();
    expect(await svc.remember('a long exchange worth remembering')).toEqual([]);
    expect(await svc.recall('anything')).toEqual([]);
    expect(await store.all()).toEqual([]);
  });

  it('ignores empty writes and empty queries', async () => {
    const { svc, store } = service({});
    expect(await svc.write('   ')).toBeNull();
    expect(await svc.recall('')).toEqual([]);
    expect(await store.all()).toEqual([]);
  });
});

describe('memory engine — dedup / update', () => {
  it('merges a near-duplicate into one entry instead of appending', async () => {
    // Two phrasings mapped to the SAME vector → cosine 1.0 ≥ threshold → merge.
    const { svc, store } = service({
      vectors: {
        'User prefers dark mode': [1, 0, 0],
        'They like dark mode in the editor': [1, 0, 0],
      },
    });
    await svc.write('User prefers dark mode', 'preference');
    await svc.write('They like dark mode in the editor', 'preference');

    const all = await store.all();
    expect(all).toHaveLength(1);
    // The merge keeps the longer (more detailed) phrasing.
    expect(all[0]?.text).toBe('They like dark mode in the editor');
  });

  it('keeps genuinely different facts as separate entries', async () => {
    const { svc, store } = service({
      vectors: { 'fact one': [1, 0, 0], 'fact two': [0, 1, 0] },
    });
    await svc.write('fact one');
    await svc.write('fact two');
    expect(await store.all()).toHaveLength(2);
  });
});

describe('memory engine — hybrid recall', () => {
  it('surfaces a semantic-only hit that keyword overlap would miss', async () => {
    // "deck" shares NO words with "slide presentation", but they map to the same
    // vector — so only the semantic channel can find it.
    const { svc } = service({
      vectors: {
        deck: [1, 0, 0],
        'Prepare the slide presentation': [1, 0, 0],
        'Lunch order: two burritos': [0, 1, 0],
      },
    });
    await svc.write('Prepare the slide presentation');
    await svc.write('Lunch order: two burritos');

    const hits = await svc.recall('deck');
    expect(hits.map((h) => h.text)).toContain('Prepare the slide presentation');
    // The orthogonal, keyword-unrelated note never surfaces.
    expect(hits.some((h) => h.text.includes('burritos'))).toBe(false);
  });

  it('breaks an exact semantic+keyword tie by recency (newer first)', async () => {
    // Both entries: equal cosine to the query (0.707) AND equal keyword overlap
    // (2), so the fused RRF ties and the newer one must win. cosine(A,B)=0.5 keeps
    // them from merging.
    const { svc } = service({
      vectors: {
        'dark mode': [2, 0, 0],
        'dark mode older': [1, 1, 0],
        'dark mode newer': [1, 0, 1],
      },
    });
    await svc.write('dark mode older'); // written first → older
    await svc.write('dark mode newer'); // written second → newer

    const hits = await svc.recall('dark mode');
    expect(hits).toHaveLength(2);
    expect(hits[0]?.text).toBe('dark mode newer');
  });

  it('ranks the stronger keyword+semantic match first', async () => {
    const { svc } = service({
      vectors: {
        'revenue deck': [1, 0, 0],
        'Q3 revenue grew 18 percent for the board deck': [1, 0, 0],
        'Revenue standup notes': [0.4, 0.9, 0],
      },
    });
    await svc.write('Q3 revenue grew 18 percent for the board deck', 'fact');
    await svc.write('Revenue standup notes', 'note');

    const hits = await svc.recall('revenue deck');
    expect(hits[0]?.text).toBe('Q3 revenue grew 18 percent for the board deck');
  });
});

describe('memory engine — remember (extraction)', () => {
  it('stores each extracted fact, collapsing duplicates among them', async () => {
    const { svc, store } = service({
      vectors: {
        'Ships on Thursday': [1, 0, 0],
        'Ships Thursday': [1, 0, 0], // same vector → dedup-merges with the first
        'QA owns the rollback plan': [0, 1, 0],
      },
      extractor: factExtractor([
        { text: 'Ships on Thursday', kind: 'event', importance: 0.7 },
        { text: 'Ships Thursday', kind: 'event', importance: 0.7 },
        { text: 'QA owns the rollback plan', kind: 'fact', importance: 0.6 },
      ]),
    });
    const stored = await svc.remember('the raw exchange text');
    // Three facts in, but two collapse → two distinct entries persisted.
    expect((await store.all()).length).toBe(2);
    expect(stored.length).toBe(3); // each call returns its (possibly merged) entry
  });
});

describe('memory engine — console management', () => {
  it('stats reports count, last-updated, and the embedding source', async () => {
    const { svc } = service({ vectors: { a: [1, 0, 0], b: [0, 1, 0] } });
    await svc.write('a');
    await svc.write('b');
    const stats = await svc.stats();
    expect(stats.count).toBe(2);
    expect(stats.updatedAt).not.toBeNull();
    expect(stats.embeddingSource).toBe('local');
  });

  it('search lists most-recent-first for an empty query', async () => {
    const { svc } = service({ vectors: { first: [1, 0, 0], second: [0, 1, 0] } });
    await svc.write('first');
    await svc.write('second');
    const rows = await svc.search('');
    expect(rows[0]?.text).toBe('second');
    // The IPC view never carries embeddings.
    expect('embedding' in (rows[0] ?? {})).toBe(false);
  });

  it('forget removes one entry; clear empties the store', async () => {
    const { svc, store } = service({ vectors: { keep: [1, 0, 0], drop: [0, 1, 0] } });
    await svc.write('keep');
    const dropped = await svc.write('drop');
    expect(await svc.forget(dropped!.id)).toEqual({ ok: true });
    expect((await store.all()).map((e) => e.text)).toEqual(['keep']);

    expect(await svc.clear()).toEqual({ ok: true });
    expect(await store.all()).toEqual([]);
  });

  it('forget reports ok:false for an unknown id', async () => {
    const { svc } = service({});
    expect(await svc.forget('nope')).toEqual({ ok: false });
  });
});
