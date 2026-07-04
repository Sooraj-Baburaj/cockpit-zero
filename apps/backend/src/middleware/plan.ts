import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

/**
 * Plan gate (P9): managed inference is a paid feature, so beyond a valid session
 * (`requireAuth` runs first and sets `userId`) the user's `plan` must be `pro`.
 * Billing is deferred — `plan` is flipped manually until the Stripe phase — but
 * the gate itself is real: a free user gets a clear 403, never our tokens.
 */
export const requireProPlan = createMiddleware<{
  Variables: { userId: string };
}>(async (c, next) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, c.get('userId')) });
  if (user?.plan !== 'pro') {
    throw new HTTPException(403, {
      message: 'CockpitZero AI requires the Pro plan.',
    });
  }
  await next();
});
