import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { ConfigSchema } from '@cockpitzero/shared';
import { db } from '../db/index.js';
import { configs } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Real cross-device config sync (P7). One config row per user, validated
 * against the shared ConfigSchema on write. Conflict policy is last-write-wins
 * on `updatedAt` — config is coarse-grained, so LWW is acceptable for now
 * (a real merge is a later refinement, per the phase doc).
 */
export const sync = new Hono()
  .use('*', requireAuth)
  // Push local config up (upsert — the newest push wins).
  .post('/', zValidator('json', ConfigSchema), async (c) => {
    const config = c.req.valid('json');
    const userId = c.get('userId');
    const updatedAt = new Date();
    await db
      .insert(configs)
      .values({ userId, payload: config, updatedAt })
      .onConflictDoUpdate({ target: configs.userId, set: { payload: config, updatedAt } });
    return c.json({ ok: true, syncedAt: updatedAt.toISOString() });
  })
  // Pull the latest config down (null when the user has never pushed).
  .get('/', async (c) => {
    const userId = c.get('userId');
    const row = await db.query.configs.findFirst({ where: eq(configs.userId, userId) });
    return c.json({
      ok: true,
      config: row?.payload ?? null,
      syncedAt: row?.updatedAt.toISOString() ?? null,
    });
  });
