import { describe, expect, it } from 'vitest';
import { createHashEmbedder, defaultConfig } from '@cockpitzero/shared';
import type { Config, MemorySyncRecord } from '@cockpitzero/shared';
import type { BackendHttp } from '../src/main/services/auth/auth-service.js';
import {
  createInMemoryMemoryStore,
  type MemoryEntry,
} from '../src/main/services/agent/memory-service.js';
import {
  createMemorySyncService,
  type MemorySyncState,
} from '../src/main/services/sync/memory-sync-service.js';

/** Config with the P8 opt-in flipped on (the default is off). */
function syncedConfig(memorySync = true): Config {
  const config = defaultConfig();
  return { ...config, ai: { ...config.ai, memorySync } };
}

function fakeHttp(responder: (path: string, init?: { json?: unknown }) => Response) {
  const calls: Array<{ path: string; method?: string; json?: unknown; token?: string }> = [];
  const http: BackendHttp = {
    baseUrl: 'http://backend.test',
    async request(path, init) {
      calls.push({ path, method: init?.method ?? 'GET', json: init?.json, token: init?.token });
      return responder(path, init);
    },
  };
  return { http, calls };
}

function fakeState(initial: number | null = null) {
  let state: MemorySyncState = { lastSyncedAt: initial };
  return {
    load: () => state,
    save: (next: MemorySyncState) => {
      state = next;
    },
    current: () => state,
  };
}

const embedder = createHashEmbedder(32);

async function entry(id: string, text: string, updatedAt: number): Promise<MemoryEntry> {
  const [embedding] = await embedder.embed([text]);
  return {
    id,
    ts: updatedAt,
    updatedAt,
    kind: 'fact',
    text,
    importance: 0.6,
    embedding: embedding!,
  };
}

const syncResponse = (entries: MemorySyncRecord[], now = 9_000) =>
  new Response(JSON.stringify({ ok: true, entries, now }));

describe('memory-sync-service', () => {
  it('refuses when signed out or when memorySync is off (opt-in)', async () => {
    const { http, calls } = fakeHttp(() => syncResponse([]));
    const store = createInMemoryMemoryStore();

    const signedOut = createMemorySyncService({
      http,
      getToken: () => null,
      getConfig: () => syncedConfig(true),
      store,
      embedder,
      state: fakeState(),
    });
    expect((await signedOut.syncNow()).ok).toBe(false);
    expect(signedOut.enabled()).toBe(false);

    const optedOut = createMemorySyncService({
      http,
      getToken: () => 'tok',
      getConfig: () => syncedConfig(false),
      store,
      embedder,
      state: fakeState(),
    });
    expect((await optedOut.syncNow()).ok).toBe(false);
    expect(calls).toHaveLength(0); // nothing left the device either way
  });

  it('pushes only entries newer than the cursor, with embeddings stripped', async () => {
    const store = createInMemoryMemoryStore([
      await entry('mem_old', 'An already-synced fact.', 1_000),
      await entry('mem_new', 'A fresh fact.', 5_000),
    ]);
    const { http, calls } = fakeHttp(() => syncResponse([]));
    const state = fakeState(2_000);

    const service = createMemorySyncService({
      http,
      getToken: () => 'tok',
      getConfig: () => syncedConfig(),
      store,
      embedder,
      state,
    });
    const result = await service.syncNow();

    expect(result).toMatchObject({ ok: true, pushed: 1, pulled: 0, syncedAt: 9_000 });
    const body = calls[0]?.json as { since: number | null; entries: Record<string, unknown>[] };
    expect(calls[0]).toMatchObject({ path: '/memory/sync', method: 'POST', token: 'tok' });
    expect(body.since).toBe(2_000);
    expect(body.entries.map((e) => e.id)).toEqual(['mem_new']);
    expect(body.entries[0]).not.toHaveProperty('embedding');
    expect(state.current().lastSyncedAt).toBe(9_000);
  });

  it('applies remote deltas LWW and re-embeds them locally', async () => {
    const store = createInMemoryMemoryStore([
      await entry('mem_shared', 'Local, newer phrasing.', 8_000),
      await entry('mem_stale', 'Local, stale phrasing.', 1_000),
    ]);
    const remote: MemorySyncRecord[] = [
      // Older than local — must NOT clobber.
      {
        id: 'mem_shared',
        ts: 1,
        updatedAt: 3_000,
        kind: 'fact',
        text: 'Remote, older.',
        importance: 0.5,
      },
      // Newer than local — must replace.
      {
        id: 'mem_stale',
        ts: 1,
        updatedAt: 7_000,
        kind: 'fact',
        text: 'Remote, newer.',
        importance: 0.5,
      },
      // Unknown locally — must be added.
      {
        id: 'mem_cloud',
        ts: 1,
        updatedAt: 6_000,
        kind: 'note',
        text: 'Cloud-only fact.',
        importance: 0.4,
      },
    ];
    const { http } = fakeHttp(() => syncResponse(remote));

    const service = createMemorySyncService({
      http,
      getToken: () => 'tok',
      getConfig: () => syncedConfig(),
      store,
      embedder,
      state: fakeState(),
    });
    const result = await service.syncNow();
    expect(result).toMatchObject({ ok: true, pulled: 2 });

    const byId = new Map((await store.all()).map((e) => [e.id, e]));
    expect(byId.get('mem_shared')?.text).toBe('Local, newer phrasing.');
    expect(byId.get('mem_stale')?.text).toBe('Remote, newer.');
    expect(byId.get('mem_cloud')?.text).toBe('Cloud-only fact.');
    // Pulled entries got a local-dimension embedding (the cloud's never travels).
    expect(byId.get('mem_cloud')?.embedding).toHaveLength(32);
  });

  it('a backend failure reports an error and keeps the cursor', async () => {
    const { http } = fakeHttp(() => new Response('{}', { status: 500 }));
    const state = fakeState(4_000);
    const service = createMemorySyncService({
      http,
      getToken: () => 'tok',
      getConfig: () => syncedConfig(),
      store: createInMemoryMemoryStore(),
      embedder,
      state,
    });
    const result = await service.syncNow();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('500');
    expect(state.current().lastSyncedAt).toBe(4_000);
  });
});
