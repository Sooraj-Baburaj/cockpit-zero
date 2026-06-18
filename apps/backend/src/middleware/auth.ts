import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

/**
 * Stub bearer-token auth. Replace with real JWT/session verification later.
 * For now it only checks that an Authorization header is present and stashes a
 * placeholder user id on the context.
 */
export const requireAuth = createMiddleware<{
  Variables: { userId: string };
}>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
  }
  // TODO: verify token signature/expiry against AUTH_SECRET.
  c.set('userId', 'stub-user');
  await next();
});
