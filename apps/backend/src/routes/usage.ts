import { Hono } from 'hono';
import { and, count, eq, gte, sum } from 'drizzle-orm';
import type { AiUsageSummary } from '@cockpitzero/shared';
import { db } from '../db/index.js';
import { usage } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Per-user usage read (P9): the "AI usage this period" aggregate for the
 * Console readout, over the `usage` meter `/inference` writes. Period =
 * the current calendar month (UTC) — the same window a future billing phase
 * will invoice. Signed-in only; free users legitimately read zeros.
 */
export const usageRoute = new Hono().use('*', requireAuth).get('/', async (c) => {
  const userId = c.get('userId');
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const [row] = await db
    .select({
      requests: count(),
      inputTokens: sum(usage.inputTokens),
      outputTokens: sum(usage.outputTokens),
    })
    .from(usage)
    .where(and(eq(usage.userId, userId), gte(usage.ts, monthStart)));

  const summary: AiUsageSummary = {
    ok: true,
    period,
    requests: row?.requests ?? 0,
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
  };
  return c.json(summary);
});
