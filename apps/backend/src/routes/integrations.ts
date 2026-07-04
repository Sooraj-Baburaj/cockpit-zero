import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { IntegrationSourceIdSchema } from '@cockpitzero/shared';
import { db } from '../db/index.js';
import { integrations } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptToken } from '../services/token-crypto.js';

/**
 * Per-user integration token storage (P10). Signed-in desktops mirror each
 * connected source's OAuth tokens here (so cloud routines can run); the token
 * JSON is encrypted at rest (`token-crypto`) and **never returned** — the GET
 * lists metadata only. Upsert per (user, source), last write wins; DELETE on
 * disconnect. Cloud routine runners read tokens server-side via `decryptToken`.
 */

const TokenPayloadSchema = z.object({
  accountLabel: z.string().default(''),
  scopes: z.array(z.string()).default([]),
  tokens: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
    /** Epoch ms when the access token expires (absent = long-lived). */
    expiresAt: z.number().optional(),
  }),
});

const SourceParamSchema = z.object({ source: IntegrationSourceIdSchema });

export const integrationsRoute = new Hono()
  .use('*', requireAuth)
  // The user's stored connections — metadata only, never tokens.
  .get('/', async (c) => {
    const userId = c.get('userId');
    const rows = await db.query.integrations.findMany({
      where: eq(integrations.userId, userId),
    });
    return c.json({
      ok: true,
      connections: rows.map((row) => ({
        source: row.source,
        accountLabel: row.accountLabel,
        scopes: row.scopes,
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  })
  // Upsert a source's tokens (called by the desktop after a successful connect).
  .post(
    '/:source',
    zValidator('param', SourceParamSchema),
    zValidator('json', TokenPayloadSchema),
    async (c) => {
      const userId = c.get('userId');
      const { source } = c.req.valid('param');
      const { accountLabel, scopes, tokens } = c.req.valid('json');
      const values = {
        userId,
        source,
        accountLabel,
        scopes,
        tokenCiphertext: encryptToken(JSON.stringify(tokens)),
        updatedAt: new Date(),
      };
      await db
        .insert(integrations)
        .values(values)
        .onConflictDoUpdate({
          target: [integrations.userId, integrations.source],
          set: {
            accountLabel: values.accountLabel,
            scopes: values.scopes,
            tokenCiphertext: values.tokenCiphertext,
            updatedAt: values.updatedAt,
          },
        });
      return c.json({ ok: true });
    },
  )
  // Remove a source's tokens (called by the desktop on disconnect). Idempotent.
  .delete('/:source', zValidator('param', SourceParamSchema), async (c) => {
    const userId = c.get('userId');
    const { source } = c.req.valid('param');
    await db
      .delete(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.source, source)));
    return c.json({ ok: true });
  });
