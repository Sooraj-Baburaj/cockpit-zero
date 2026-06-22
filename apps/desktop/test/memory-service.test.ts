import { describe, it, expect } from 'vitest';
import { defaultConfig, type Config } from '@cockpitzero/shared';
import {
  createMemoryService,
  type MemoryEntry,
  type MemoryStore,
} from '../src/main/services/agent/memory-service.js';

/**
 * The memory service is dependency-inverted (a `MemoryStore` port + config
 * reader), so we exercise it with an in-memory fake — no electron, no disk.
 */
function fakeStore(seed: MemoryEntry[] = []): MemoryStore {
  let entries = [...seed];
  return {
    all: () => entries,
    append: (e) => {
      entries = [...entries, e];
    },
  };
}

function configWith(memoryEnabled: boolean): Config {
  const base = defaultConfig();
  return { ...base, ai: { ...base.ai, memoryEnabled } };
}

describe('createMemoryService', () => {
  it('writes and recalls entries by keyword overlap', () => {
    const store = fakeStore();
    let t = 1_000;
    const mem = createMemoryService({
      store,
      getConfig: () => configWith(true),
      now: () => (t += 1000),
      newId: () => `id_${t}`,
    });

    mem.write('Q3 revenue grew 18% — deck for the board', 'session');
    mem.write('Lunch order: two burritos', 'note');
    mem.write('Revenue standup: ARR up, churn flat', 'session');

    const hits = mem.recall('revenue deck for q3');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    // The entry sharing the most query terms ranks first.
    expect(hits[0]?.text).toContain('Q3 revenue');
    // The unrelated note never surfaces.
    expect(hits.some((h) => h.text.includes('burritos'))).toBe(false);
  });

  it('is a no-op when memory is disabled', () => {
    const store = fakeStore();
    const mem = createMemoryService({ store, getConfig: () => configWith(false) });

    expect(mem.enabled()).toBe(false);
    expect(mem.write('anything')).toBeNull();
    expect(store.all()).toEqual([]);
    expect(mem.recall('anything')).toEqual([]);
  });

  it('ignores empty writes and empty queries', () => {
    const store = fakeStore();
    const mem = createMemoryService({ store, getConfig: () => configWith(true) });
    expect(mem.write('   ')).toBeNull();
    expect(mem.recall('')).toEqual([]);
    expect(store.all()).toEqual([]);
  });

  it('caps recall to the requested limit', () => {
    const store = fakeStore();
    const mem = createMemoryService({ store, getConfig: () => configWith(true) });
    for (let i = 0; i < 8; i++) mem.write(`deck draft number ${i}`);
    expect(mem.recall('deck', 3)).toHaveLength(3);
  });
});
