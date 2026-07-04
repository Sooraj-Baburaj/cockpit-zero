import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { auth } from '../auth.js';
import { env } from '../env.js';

/**
 * The desktop OAuth handoff (P7). Electron can't receive better-auth's session
 * cookie (OAuth happens in the *system browser*), so this bridges the gap with
 * a short-lived one-time code — the same shape as an OAuth authorization code:
 *
 *   1. `GET /desktop-auth/start?provider=google&port=NNNNN` — the app opens
 *      this in the browser; we start the social sign-in and redirect out to
 *      the provider (preserving better-auth's state cookie).
 *   2. The provider calls back into better-auth, which establishes the browser
 *      session and lands on `GET /desktop-auth/complete?port=NNNNN`.
 *   3. `complete` mints a one-time code bound to the session token and
 *      redirects to the app's loopback listener (`http://127.0.0.1:NNNNN`).
 *   4. The app exchanges it — `POST /desktop-auth/exchange { code }` → the
 *      bearer session token, which it stores in the OS-keychain vault.
 *
 * The session token itself never rides a browser URL; codes are single-use and
 * expire in 5 minutes. The in-memory store is fine for the single-instance VPS.
 */

const CODE_TTL_MS = 5 * 60_000;
const pendingCodes = new Map<string, { token: string; expiresAt: number }>();

function issueCode(token: string): string {
  for (const [code, entry] of pendingCodes) {
    if (entry.expiresAt < Date.now()) pendingCodes.delete(code);
  }
  const code = randomBytes(32).toString('base64url');
  pendingCodes.set(code, { token, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** Loopback ports are ephemeral/user range only. */
const PortSchema = z.coerce.number().int().min(1024).max(65535);

const StartQuery = z.object({
  provider: z.enum(['google', 'github']),
  port: PortSchema,
});

export const desktopAuth = new Hono()
  .get('/start', zValidator('query', StartQuery), async (c) => {
    const { provider, port } = c.req.valid('query');
    const res = await auth.api.signInSocial({
      body: {
        provider,
        callbackURL: `${env.BETTER_AUTH_URL}/desktop-auth/complete?port=${port}`,
      },
      asResponse: true,
    });
    if (!res.ok) {
      throw new HTTPException(502, { message: `Could not start ${provider} sign-in` });
    }
    const { url } = (await res.json()) as { url?: string };
    if (!url) {
      throw new HTTPException(502, { message: `${provider} sign-in returned no redirect URL` });
    }
    // Redirect the browser to the provider while preserving the set-cookie
    // headers better-auth attached (the OAuth state lives there).
    const headers = new Headers(res.headers);
    headers.delete('Content-Type');
    headers.delete('Content-Length');
    headers.set('Location', url);
    return new Response(null, { status: 302, headers });
  })
  .get('/complete', zValidator('query', z.object({ port: PortSchema })), async (c) => {
    const { port } = c.req.valid('query');
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.text('Sign-in did not complete. Return to CockpitZero and try again.', 401);
    }
    const code = issueCode(session.session.token);
    return c.redirect(`http://127.0.0.1:${port}/callback?code=${code}`);
  })
  .post('/exchange', zValidator('json', z.object({ code: z.string().min(1) })), (c) => {
    const { code } = c.req.valid('json');
    const entry = pendingCodes.get(code);
    pendingCodes.delete(code); // single-use, success or not
    if (!entry || entry.expiresAt < Date.now()) {
      throw new HTTPException(401, { message: 'Invalid or expired code' });
    }
    return c.json({ ok: true, token: entry.token });
  });
