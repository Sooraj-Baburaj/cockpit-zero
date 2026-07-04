import { describe, expect, it } from 'vitest';
import type { BackendHttp } from '../src/main/services/auth/auth-service.js';
import {
  createKnowledgeService,
  type KnowledgeUpload,
} from '../src/main/services/knowledge/knowledge-service.js';

/** Desktop knowledge-ingest flows against fake ports (no electron/fs/network). */

function fakeHttp(
  responder: (path: string, init?: { json?: unknown; method?: string }) => Response,
) {
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

const upload = (name: string): KnowledgeUpload => ({ name, type: 'text', content: 'aGVsbG8=' });

function service(over: {
  http: BackendHttp;
  token?: string | null;
  picked?: string[];
  loaded?: { uploads: KnowledgeUpload[]; skipped: string[] };
}) {
  return createKnowledgeService({
    http: over.http,
    getToken: () => (over.token === undefined ? 'tok' : over.token),
    pickPaths: async () => over.picked ?? [],
    loadFiles: async () => over.loaded ?? { uploads: [], skipped: [] },
  });
}

describe('knowledge-service', () => {
  it('everything requires a session', async () => {
    const { http, calls } = fakeHttp(() => new Response('{}'));
    const svc = service({ http, token: null });

    expect(await svc.ingest([])).toMatchObject({ ok: false, docIds: [] });
    expect((await svc.list()).ok).toBe(false);
    expect((await svc.remove('doc1')).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('empty paths open the picker; cancelling is not an error', async () => {
    const { http, calls } = fakeHttp(() => new Response('{}'));
    const result = await service({ http, picked: [] }).ingest([]);
    expect(result).toEqual({ ok: true, docIds: [] });
    expect(calls).toHaveLength(0);
  });

  it('uploads each loaded document and collects the doc ids', async () => {
    let n = 0;
    const { http, calls } = fakeHttp(
      () => new Response(JSON.stringify({ ok: true, docId: `doc_${(n += 1)}`, chunks: 3 })),
    );
    const result = await service({
      http,
      picked: ['/docs'],
      loaded: { uploads: [upload('a.txt'), upload('b.pdf')], skipped: [] },
    }).ingest([]);

    expect(result).toMatchObject({ ok: true, docIds: ['doc_1', 'doc_2'] });
    expect(result.error).toBeUndefined();
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ path: '/knowledge', method: 'POST', token: 'tok' });
    expect((calls[0]?.json as KnowledgeUpload).name).toBe('a.txt');
  });

  it('reports failed uploads and skipped files by name', async () => {
    const { http } = fakeHttp((_path, init) =>
      (init?.json as KnowledgeUpload).name === 'bad.pdf'
        ? new Response(JSON.stringify({ ok: false, error: 'no text' }), { status: 422 })
        : new Response(JSON.stringify({ ok: true, docId: 'doc_ok' })),
    );
    const result = await service({
      http,
      loaded: { uploads: [upload('good.txt'), upload('bad.pdf')], skipped: ['huge.pdf'] },
    }).ingest(['/docs']);

    expect(result.ok).toBe(true); // something made it in…
    expect(result.docIds).toEqual(['doc_ok']);
    expect(result.error).toContain('bad.pdf');
    expect(result.error).toContain('huge.pdf');
  });

  it('nothing supported selected is an explicit error', async () => {
    const { http } = fakeHttp(() => new Response('{}'));
    const result = await service({
      http,
      loaded: { uploads: [], skipped: ['image.png'] },
    }).ingest(['/image.png']);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('list returns the docs; remove issues an auth-scoped DELETE', async () => {
    const docs = [{ docId: 'doc1', name: 'a.txt', chunks: 3, status: 'ready', createdAt: 1 }];
    const { http, calls } = fakeHttp((path) =>
      path === '/knowledge'
        ? new Response(JSON.stringify({ ok: true, docs }))
        : new Response(JSON.stringify({ ok: true })),
    );
    const svc = service({ http });

    expect(await svc.list()).toEqual({ ok: true, docs });
    expect(await svc.remove('doc1')).toMatchObject({ ok: true });
    expect(calls[1]).toMatchObject({ path: '/knowledge/doc1', method: 'DELETE', token: 'tok' });
  });

  it('degrades with an error message when the backend is unreachable', async () => {
    const http: BackendHttp = {
      baseUrl: 'http://backend.test',
      request: async () => {
        throw new Error('network down');
      },
    };
    const svc = service({ http, loaded: { uploads: [upload('a.txt')], skipped: [] } });
    expect((await svc.ingest(['/a.txt'])).ok).toBe(false);
    expect((await svc.list()).ok).toBe(false);
  });
});
