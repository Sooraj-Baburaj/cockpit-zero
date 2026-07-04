import { describe, expect, it } from 'vitest';
import { ConfigSchema, defaultConfig, type Config } from '@cockpitzero/shared';
import { app } from '../src/app.js';
import { authed, signUpToken } from './helpers.js';

describe('sync (real persistence)', () => {
  it('rejects requests without a session', async () => {
    expect((await app.request('/sync')).status).toBe(401);
    const post = await app.request('/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaultConfig()),
    });
    expect(post.status).toBe(401);
  });

  it('pull before any push returns null', async () => {
    const token = await signUpToken('fresh@example.com');
    const res = await app.request('/sync', { headers: authed(token) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; config: Config | null };
    expect(body.config).toBeNull();
  });

  it('round-trips a config through ConfigSchema', async () => {
    const token = await signUpToken('roundtrip@example.com');
    const config = defaultConfig();

    const push = await app.request('/sync', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify(config),
    });
    expect(push.status).toBe(200);
    const pushed = (await push.json()) as { ok: boolean; syncedAt: string };
    expect(pushed.ok).toBe(true);
    expect(Date.parse(pushed.syncedAt)).not.toBeNaN();

    const pull = await app.request('/sync', { headers: authed(token) });
    const body = (await pull.json()) as { config: unknown };
    expect(ConfigSchema.parse(body.config)).toEqual(config);
  });

  it('a second push replaces the first (last-write-wins upsert)', async () => {
    const token = await signUpToken('lww@example.com');
    const first = defaultConfig();
    const second: Config = {
      ...defaultConfig(),
      aliases: [{ id: 'al_1', keyword: 'gh', label: 'GitHub', actionId: 'act_1' }],
    };

    for (const config of [first, second]) {
      const res = await app.request('/sync', {
        method: 'POST',
        headers: authed(token),
        body: JSON.stringify(config),
      });
      expect(res.status).toBe(200);
    }

    const pull = await app.request('/sync', { headers: authed(token) });
    const body = (await pull.json()) as { config: Config };
    expect(body.config.aliases).toHaveLength(1);
    expect(body.config.aliases[0]?.keyword).toBe('gh');
  });

  it('rejects a body that fails ConfigSchema', async () => {
    const token = await signUpToken('invalid@example.com');
    const res = await app.request('/sync', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ version: 999 }),
    });
    expect(res.status).toBe(400);
  });

  it('users only see their own config', async () => {
    const alice = await signUpToken('alice@example.com');
    const bob = await signUpToken('bob@example.com');

    await app.request('/sync', {
      method: 'POST',
      headers: authed(alice),
      body: JSON.stringify(defaultConfig()),
    });

    const bobPull = await app.request('/sync', { headers: authed(bob) });
    const body = (await bobPull.json()) as { config: Config | null };
    expect(body.config).toBeNull();
  });
});
