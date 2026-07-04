import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { auth } from './auth.js';
import { health } from './routes/health.js';
import { sync } from './routes/sync.js';
import { desktopAuth } from './routes/desktop-auth.js';
import { memory } from './routes/memory.js';
import { knowledgeRoute } from './routes/knowledge.js';
import { inference } from './routes/inference.js';
import { usageRoute } from './routes/usage.js';

/**
 * The Hono app. Exported separately from the server (src/index.ts) so tests can
 * exercise routes via `app.request(...)` without binding a port.
 *
 * `/auth/*` is better-auth's own handler (sign-up/sign-in/sign-out/get-session,
 * OAuth callbacks, verification + reset — its basePath is '/auth');
 * `/desktop-auth/*` is our loopback handoff for the desktop OAuth flow.
 */
export const app = new Hono()
  .use('*', logger())
  .use('*', cors())
  .route('/health', health)
  .route('/sync', sync)
  .route('/memory', memory)
  .route('/knowledge', knowledgeRoute)
  .route('/inference', inference)
  .route('/usage', usageRoute)
  .route('/desktop-auth', desktopAuth)
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ ok: false, error: 'Internal Server Error' }, 500);
  })
  .notFound((c) => c.json({ ok: false, error: 'Not Found' }, 404));

export type AppType = typeof app;
