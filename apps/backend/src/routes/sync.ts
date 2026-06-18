import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ConfigSchema } from '@cockpitzero/shared';
import { requireAuth } from '../middleware/auth.js';

/**
 * Config sync across devices (auth-gated, stubbed). The shared ConfigSchema is
 * the source of truth for the request body — no separate validation type.
 */
export const sync = new Hono()
  .use('*', requireAuth)
  // Push local config up.
  .post('/', zValidator('json', ConfigSchema), (c) => {
    const config = c.req.valid('json');
    const userId = c.get('userId');
    // TODO: persist `config` for `userId` via db (configs table).
    return c.json({ ok: true, userId, syncedAt: new Date().toISOString(), config });
  })
  // Pull latest config down.
  .get('/', (c) => {
    const userId = c.get('userId');
    // TODO: load latest config for `userId`; null means none yet.
    return c.json({ ok: true, userId, config: null });
  });
