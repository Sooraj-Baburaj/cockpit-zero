import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';

/** Create an account (better-auth email/password) and return the raw response. */
function signUp(email: string) {
  return app.request('/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'a-strong-password-123', name: 'Test User' }),
  });
}

describe('auth (better-auth, real sessions)', () => {
  it('signs up and returns a bearer session token', async () => {
    const res = await signUp('signup@example.com');
    expect(res.status).toBe(200);
    // The bearer plugin surfaces the session token in this header — it's what
    // the desktop stores in the vault.
    expect(res.headers.get('set-auth-token')).toBeTruthy();
  });

  it('resolves the signed-in user from a bearer token, with the plan field', async () => {
    const token = (await signUp('whoami@example.com')).headers.get('set-auth-token')!;
    const res = await app.request('/auth/get-session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string; plan: string } };
    expect(body.user.email).toBe('whoami@example.com');
    expect(body.user.plan).toBe('free');
  });

  it('signs in with the right password and rejects the wrong one', async () => {
    await signUp('password@example.com');
    const signIn = (password: string) =>
      app.request('/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'password@example.com', password }),
      });

    const ok = await signIn('a-strong-password-123');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-auth-token')).toBeTruthy();

    const bad = await signIn('not-the-password');
    expect(bad.status).toBe(401);
  });

  it('sign-out invalidates the session', async () => {
    const token = (await signUp('signout@example.com')).headers.get('set-auth-token')!;
    const out = await app.request('/auth/sign-out', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(out.status).toBe(200);

    const after = await app.request('/sync', { headers: { Authorization: `Bearer ${token}` } });
    expect(after.status).toBe(401);
  });

  it('the old stub token no longer authenticates (the stub is gone)', async () => {
    const res = await app.request('/sync', { headers: { Authorization: 'Bearer stub-token' } });
    expect(res.status).toBe(401);
  });

  it('desktop-auth exchange rejects unknown codes', async () => {
    const res = await app.request('/desktop-auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'not-a-real-code' }),
    });
    expect(res.status).toBe(401);
  });

  it('desktop-auth start validates provider and port', async () => {
    const res = await app.request('/desktop-auth/start?provider=evil&port=99999');
    expect(res.status).toBe(400);
  });
});
