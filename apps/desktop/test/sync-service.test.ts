import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@cockpitzero/shared';
import type { BackendHttp } from '../src/main/services/auth/auth-service.js';
import { createSyncService } from '../src/main/services/sync/sync-service.js';

function fakeHttp(
  responder: (path: string, init?: { json?: unknown; token?: string }) => Response,
) {
  const calls: Array<{ path: string; method?: string; token?: string }> = [];
  const http: BackendHttp = {
    baseUrl: 'http://backend.test',
    async request(path, init) {
      calls.push({ path, method: init?.method ?? 'GET', token: init?.token });
      return responder(path, init);
    },
  };
  return { http, calls };
}

describe('sync-service', () => {
  it('push requires a session', async () => {
    const { http, calls } = fakeHttp(() => new Response('{}'));
    const service = createSyncService({ http, getToken: () => null, getConfig: defaultConfig });

    const result = await service.push();
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('push sends the current config with the bearer token', async () => {
    let sent: unknown;
    const { http, calls } = fakeHttp((_path, init) => {
      sent = init?.json;
      return new Response(JSON.stringify({ ok: true, syncedAt: '2026-07-03T00:00:00.000Z' }));
    });
    const service = createSyncService({
      http,
      getToken: () => 'tok_live',
      getConfig: defaultConfig,
    });

    const result = await service.push();
    expect(result).toEqual({ ok: true, syncedAt: '2026-07-03T00:00:00.000Z' });
    expect(calls[0]).toMatchObject({ path: '/sync', method: 'POST', token: 'tok_live' });
    expect(sent).toEqual(defaultConfig());
  });

  it('pull returns a validated config, or null when never pushed', async () => {
    const config = defaultConfig();
    let payload: unknown = null;
    const { http } = fakeHttp(() => new Response(JSON.stringify({ ok: true, config: payload })));
    const service = createSyncService({
      http,
      getToken: () => 'tok_live',
      getConfig: defaultConfig,
    });

    expect(await service.pull()).toEqual({ ok: true, config: null });

    payload = config;
    expect(await service.pull()).toEqual({ ok: true, config });
  });

  it('pull rejects a cloud payload that fails ConfigSchema', async () => {
    const { http } = fakeHttp(
      () => new Response(JSON.stringify({ ok: true, config: { version: 999 } })),
    );
    const service = createSyncService({
      http,
      getToken: () => 'tok_live',
      getConfig: defaultConfig,
    });

    const result = await service.pull();
    expect(result.ok).toBe(false);
    expect(result.config).toBeNull();
  });

  it('maps backend/network failures to error results', async () => {
    const { http } = fakeHttp(() => new Response('{}', { status: 500 }));
    const service = createSyncService({
      http,
      getToken: () => 'tok_live',
      getConfig: defaultConfig,
    });

    expect((await service.push()).ok).toBe(false);
    expect((await service.pull()).ok).toBe(false);
  });
});
