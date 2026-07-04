import { describe, expect, it } from 'vitest';
import { createHashEmbedder, defaultConfig } from '@cockpitzero/shared';
import type { Config } from '@cockpitzero/shared';
import type { BackendHttp } from '../src/main/services/auth/auth-service.js';
import {
  createInMemoryMemoryStore,
  createMemoryService,
  type MemoryEntry,
  type MemoryService,
} from '../src/main/services/agent/memory-service.js';
import { withCloudRecall } from '../src/main/services/memory/cloud-recall.js';

/**
 * P8 cloud recall fusion: local ∪ cloud memories ∪ knowledge when signed in with
 * memorySync on; clean local-only degrade for every other state (signed out,
 * opted out, offline/erroring backend).
 */

function config(over: Partial<Config['ai']> = {}): Config {
  const base = defaultConfig();
  return { ...base, ai: { ...base.ai, memoryEnabled: true, memorySync: true, ...over } };
}

const embedder = createHashEmbedder(32);

async function seeded(texts: Record<string, string>): Promise<MemoryService> {
  const entries: MemoryEntry[] = [];
  for (const [id, text] of Object.entries(texts)) {
    const [embedding] = await embedder.embed([text]);
    entries.push({
      id,
      ts: 1,
      updatedAt: 1,
      kind: 'fact',
      text,
      importance: 0.6,
      embedding: embedding!,
    });
  }
  return createMemoryService({
    store: createInMemoryMemoryStore(entries),
    embedder,
    extractor: { extract: async () => [] },
    getConfig: () => config(),
  });
}

function fakeHttp(responder: (path: string) => Response) {
  const calls: string[] = [];
  const http: BackendHttp = {
    baseUrl: 'http://backend.test',
    async request(path) {
      calls.push(path);
      return responder(path);
    },
  };
  return { http, calls };
}

const cloudEntry = (id: string, text: string) => ({
  id,
  ts: 1,
  updatedAt: 2,
  kind: 'fact',
  text,
  importance: 0.6,
});

const backendResponder =
  (entries: unknown[], hits: unknown[]) =>
  (path: string): Response =>
    path.startsWith('/memory/search')
      ? new Response(JSON.stringify({ ok: true, entries }))
      : new Response(JSON.stringify({ ok: true, hits }));

describe('cloud recall', () => {
  it('stays local-only when signed out (no backend call at all)', async () => {
    const local = await seeded({ mem_l: 'The deck lives in Documents.' });
    const { http, calls } = fakeHttp(backendResponder([], []));
    const service = withCloudRecall(local, {
      http,
      getToken: () => null,
      getConfig: () => config(),
    });

    const hits = await service.recall('deck');
    expect(hits.map((h) => h.id)).toEqual(['mem_l']);
    expect(calls).toHaveLength(0);
  });

  it('stays local-only when memorySync is off (opt-in respected)', async () => {
    const local = await seeded({ mem_l: 'The deck lives in Documents.' });
    const { http, calls } = fakeHttp(backendResponder([cloudEntry('mem_c', 'cloud deck')], []));
    const service = withCloudRecall(local, {
      http,
      getToken: () => 'tok',
      getConfig: () => config({ memorySync: false }),
    });

    const hits = await service.recall('deck');
    expect(hits.map((h) => h.id)).toEqual(['mem_l']);
    expect(calls).toHaveLength(0);
  });

  it('fuses local + cloud + knowledge, deduping shared ids in favor of local', async () => {
    const local = await seeded({
      mem_l: 'The deck lives in Documents.',
      mem_shared: 'Local copy of the synced fact about the deck.',
    });
    const { http, calls } = fakeHttp(
      backendResponder(
        [
          cloudEntry('mem_shared', 'CLOUD copy of the synced fact.'),
          cloudEntry('mem_cloud', 'A cloud-only fact about the deck.'),
        ],
        [
          {
            docId: 'doc1',
            docName: 'q3-brief.pdf',
            chunk: 'The deck covers Q3 revenue.',
            score: 0.9,
          },
        ],
      ),
    );
    const service = withCloudRecall(local, {
      http,
      getToken: () => 'tok',
      getConfig: () => config(),
    });

    const hits = await service.recall('deck', 10);
    const ids = hits.map((h) => h.id);
    expect(ids).toContain('mem_l');
    expect(ids).toContain('mem_cloud');
    expect(calls.some((p) => p.startsWith('/memory/search'))).toBe(true);
    expect(calls.some((p) => p.startsWith('/knowledge/search'))).toBe(true);

    // Shared id: exactly once, and the LOCAL item wins.
    expect(ids.filter((id) => id === 'mem_shared')).toHaveLength(1);
    expect(hits.find((h) => h.id === 'mem_shared')?.text).toContain('Local copy');

    // Knowledge surfaces as a citable entry (kind + source doc name).
    const knowledge = hits.find((h) => h.kind === 'knowledge');
    expect(knowledge?.source).toBe('q3-brief.pdf');
    expect(knowledge?.text).toContain('Q3 revenue');
  });

  it('degrades to local-only when the backend errors or is unreachable', async () => {
    const local = await seeded({ mem_l: 'The deck lives in Documents.' });

    const erroring = withCloudRecall(local, {
      http: fakeHttp(() => new Response('{}', { status: 500 })).http,
      getToken: () => 'tok',
      getConfig: () => config(),
    });
    expect((await erroring.recall('deck')).map((h) => h.id)).toEqual(['mem_l']);

    const offline = withCloudRecall(local, {
      http: {
        baseUrl: 'http://backend.test',
        request: async () => {
          throw new Error('network down');
        },
      },
      getToken: () => 'tok',
      getConfig: () => config(),
    });
    expect((await offline.recall('deck')).map((h) => h.id)).toEqual(['mem_l']);
  });

  it('leaves the gated local behavior intact (memory off ⇒ empty recall)', async () => {
    // Memory off ⇒ local recall is empty, and the decorator must not resurrect
    // it with cloud results.
    const gatedLocal = createMemoryService({
      store: createInMemoryMemoryStore(),
      embedder,
      extractor: { extract: async () => [] },
      getConfig: () => config({ memoryEnabled: false }),
    });
    const gated = withCloudRecall(gatedLocal, {
      http: fakeHttp(backendResponder([cloudEntry('mem_c', 'cloud deck')], [])).http,
      getToken: () => 'tok',
      getConfig: () => config({ memoryEnabled: false }),
    });
    expect(await gated.recall('deck')).toEqual([]);
  });
});
