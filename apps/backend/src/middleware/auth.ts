import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { auth } from '../auth.js';

/**
 * Real session auth (P7 — the stub is gone). Validates the request against
 * better-auth, which accepts either its session cookie (browser flows) or an
 * `Authorization: Bearer <token>` header (the desktop app, via the bearer
 * plugin), and stashes the real user id on the context.
 */
export const requireAuth = createMiddleware<{
  Variables: { userId: string };
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    throw new HTTPException(401, { message: 'Missing or invalid session' });
  }
  c.set('userId', session.user.id);
  await next();
});
