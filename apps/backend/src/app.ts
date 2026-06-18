import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { health } from './routes/health.js';
import { sync } from './routes/sync.js';
import { auth } from './routes/auth.js';

/**
 * The Hono app. Exported separately from the server (src/index.ts) so tests can
 * exercise routes via `app.request(...)` without binding a port.
 */
export const app = new Hono()
  .use('*', logger())
  .use('*', cors())
  .route('/health', health)
  .route('/sync', sync)
  .route('/auth', auth)
  .onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ ok: false, error: 'Internal Server Error' }, 500);
  })
  .notFound((c) => c.json({ ok: false, error: 'Not Found' }, 404));

export type AppType = typeof app;
