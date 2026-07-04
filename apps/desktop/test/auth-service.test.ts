import { describe, expect, it } from 'vitest';
import { SecretName } from '@cockpitzero/shared';
import {
  createAuthService,
  type AuthPorts,
  type BackendHttp,
  type LoopbackHandle,
  type TokenVault,
} from '../src/main/services/auth/auth-service.js';

/** In-memory vault fake (mirrors the SecretsService contract). */
function fakeVault(available = true): TokenVault & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    set(name, value) {
      if (!available) return { ok: false };
      values.set(name, value);
      return { ok: true };
    },
    get(name) {
      return values.get(name) ?? null;
    },
    delete(name) {
      values.delete(name);
      return { ok: true };
    },
  };
}

/** Scripted HTTP fake: path → responder. Records every call. */
function fakeHttp(
  routes: Record<string, (init?: { json?: unknown; token?: string }) => Response>,
): BackendHttp & { calls: Array<{ path: string; token?: string }> } {
  const calls: Array<{ path: string; token?: string }> = [];
  return {
    baseUrl: 'http://backend.test',
    calls,
    async request(path, init) {
      calls.push({ path, token: init?.token });
      const responder = routes[path];
      if (!responder) throw new Error(`Unscripted request: ${path}`);
      return responder(init);
    },
  };
}

const tokenResponse = (token: string) =>
  new Response('{}', { status: 200, headers: { 'set-auth-token': token } });

function ports(overrides: Partial<AuthPorts> & Pick<AuthPorts, 'http' | 'vault'>): AuthPorts {
  return {
    openExternal: () => {},
    openLoopback: () => Promise.reject(new Error('no loopback in this test')),
    ...overrides,
  };
}

describe('auth-service', () => {
  it('password sign-in stores the bearer token in the vault', async () => {
    const vault = fakeVault();
    const http = fakeHttp({ '/auth/sign-in/email': () => tokenResponse('tok_123') });
    const service = createAuthService(ports({ http, vault }));

    const result = await service.signIn('password', { email: 'a@b.co', password: 'pw-123456' });
    expect(result).toEqual({ ok: true });
    expect(vault.get(SecretName.sessionToken)).toBe('tok_123');
  });

  it('password sign-up hits the sign-up route with a derived name', async () => {
    const vault = fakeVault();
    let body: unknown;
    const http = fakeHttp({
      '/auth/sign-up/email': (init) => {
        body = init?.json;
        return tokenResponse('tok_new');
      },
    });
    const service = createAuthService(ports({ http, vault }));

    const result = await service.signIn('password', {
      email: 'new@user.dev',
      password: 'pw-123456',
      create: true,
    });
    expect(result.ok).toBe(true);
    expect(body).toMatchObject({ email: 'new@user.dev', name: 'new' });
  });

  it('surfaces the backend error message on a failed sign-in', async () => {
    const http = fakeHttp({
      '/auth/sign-in/email': () =>
        new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 }),
    });
    const service = createAuthService(ports({ http, vault: fakeVault() }));

    const result = await service.signIn('password', { email: 'a@b.co', password: 'wrong' });
    expect(result).toEqual({ ok: false, error: 'Invalid email or password' });
  });

  it('refuses to store a token when secure storage is unavailable', async () => {
    const vault = fakeVault(false);
    const http = fakeHttp({ '/auth/sign-in/email': () => tokenResponse('tok_123') });
    const service = createAuthService(ports({ http, vault }));

    const result = await service.signIn('password', { email: 'a@b.co', password: 'pw-123456' });
    expect(result.ok).toBe(false);
    expect(vault.values.size).toBe(0);
  });

  it('OAuth opens the browser, exchanges the loopback code, and closes the listener', async () => {
    const vault = fakeVault();
    let opened = '';
    let closed = false;
    const loopback: LoopbackHandle = {
      port: 45678,
      code: Promise.resolve('code_abc'),
      close: () => {
        closed = true;
      },
    };
    const http = fakeHttp({
      '/desktop-auth/exchange': (init) => {
        expect(init?.json).toEqual({ code: 'code_abc' });
        return new Response(JSON.stringify({ ok: true, token: 'tok_oauth' }), { status: 200 });
      },
    });
    const service = createAuthService(
      ports({
        http,
        vault,
        openExternal: (url) => {
          opened = url;
        },
        openLoopback: () => Promise.resolve(loopback),
      }),
    );

    const result = await service.signIn('google');
    expect(result).toEqual({ ok: true });
    expect(opened).toBe('http://backend.test/desktop-auth/start?provider=google&port=45678');
    expect(vault.get(SecretName.sessionToken)).toBe('tok_oauth');
    expect(closed).toBe(true);
  });

  it('OAuth times out cleanly when the browser never comes back', async () => {
    let closed = false;
    const loopback: LoopbackHandle = {
      port: 45678,
      code: new Promise<string>(() => {}), // never resolves
      close: () => {
        closed = true;
      },
    };
    const service = createAuthService(
      ports({
        http: fakeHttp({}),
        vault: fakeVault(),
        openLoopback: () => Promise.resolve(loopback),
        oauthTimeoutMs: 5,
      }),
    );

    const result = await service.signIn('github');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timed out/i);
    expect(closed).toBe(true);
  });

  it('sign-out revokes the session and clears the vault, even offline', async () => {
    const vault = fakeVault();
    vault.set(SecretName.sessionToken, 'tok_live');
    const http = fakeHttp({
      '/auth/sign-out': () => {
        throw new Error('network down');
      },
    });
    const service = createAuthService(ports({ http, vault }));

    await service.signOut();
    expect(vault.get(SecretName.sessionToken)).toBeNull();
  });

  it('status reflects the session (and reads signed-out with no token, no request)', async () => {
    const vault = fakeVault();
    const http = fakeHttp({
      '/auth/get-session': (init) => {
        expect(init?.token).toBe('tok_live');
        return new Response(JSON.stringify({ user: { email: 'a@b.co', plan: 'pro' } }), {
          status: 200,
        });
      },
    });
    const service = createAuthService(ports({ http, vault }));

    expect(await service.status()).toEqual({ signedIn: false });
    expect(http.calls).toHaveLength(0);

    vault.set(SecretName.sessionToken, 'tok_live');
    expect(await service.status()).toEqual({ signedIn: true, email: 'a@b.co', plan: 'pro' });
  });
});
