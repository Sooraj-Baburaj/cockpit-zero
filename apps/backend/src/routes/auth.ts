import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Auth/license endpoints (stubbed — returns a placeholder token). */
export const auth = new Hono()
  .post('/login', zValidator('json', LoginSchema), (c) => {
    const { email } = c.req.valid('json');
    // TODO: verify credentials, issue a signed token.
    return c.json({ ok: true, token: 'stub-token', user: { email } });
  })
  .post('/logout', (c) => c.json({ ok: true }));
