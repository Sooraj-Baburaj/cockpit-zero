import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, asc, cosineDistance, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { MemorySyncRequestSchema, fuseHybridChannels } from '@cockpitzero/shared';
import type { MemorySyncRecord } from '@cockpitzero/shared';
import { db } from '../db/index.js';
import { memories } from '../db/schema.js';
import type { MemoryRow } from '../db/schema.js';
import { embedder } from '../embedder.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Cloud memory (P8) — the pgvector twin of the desktop's local engine, for
 * signed-in users who opted into `ai.memorySync`.
 *
 * `POST /sync` is the delta exchange: the device pushes entries changed since
 * its last sync, the server upserts them (**LWW** on `updatedAt`, **dedup** on
 * exact text so the same fact extracted on two devices collapses into one row)
 * and returns the entries the device is missing. The server **re-embeds** every
 * stored text with its own model so the cloud index stays dimension-consistent
 * (devices never upload vectors — see the phase-8 risk note).
 *
 * `GET /search` is server hybrid recall mirroring P5: pgvector cosine (semantic)
 * + Postgres FTS (keyword), fused with the SAME shared RRF/recency/importance
 * math the local engine uses (`fuseHybridChannels`).
 */

const SEMANTIC_POOL = 20;
const KEYWORD_POOL = 50;
const SEMANTIC_FLOOR = 0;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 50;
const PULL_LIMIT = 1_000;

/** Strip the server-side embedding before a row goes on the wire. */
function toWire(row: MemoryRow): MemorySyncRecord {
  return {
    id: row.id,
    ts: row.ts,
    updatedAt: row.updatedAt,
    kind: row.kind,
    text: row.text,
    importance: row.importance,
    source: row.source ?? undefined,
  };
}

/** Hybrid recall over one user's memories (shared fusion math). */
async function searchMemories(userId: string, query: string, limit: number): Promise<MemoryRow[]> {
  const q = query.trim();
  if (q === '') return [];

  const [queryVec] = await embedder.embed([q]);
  if (!queryVec) return [];

  // Semantic channel: nearest neighbors by cosine (pgvector `<=>` is distance;
  // similarity = 1 − distance), above the same noise floor the local engine uses.
  const distance = cosineDistance(memories.embedding, queryVec);
  const semanticRows = await db
    .select({ row: memories, score: sql<number>`1 - (${distance})` })
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(asc(distance))
    .limit(SEMANTIC_POOL);
  const semantic = semanticRows.filter((s) => s.score > SEMANTIC_FLOOR);

  // Keyword channel: Postgres FTS rank (the server-scale stand-in for the local
  // engine's term-overlap scan — only the ordering feeds the fusion).
  const tsQuery = sql`plainto_tsquery('english', ${q})`;
  const keyword = await db
    .select({
      row: memories,
      score: sql<number>`ts_rank(to_tsvector('english', ${memories.text}), ${tsQuery})`,
    })
    .from(memories)
    .where(
      and(eq(memories.userId, userId), sql`to_tsvector('english', ${memories.text}) @@ ${tsQuery}`),
    )
    .limit(KEYWORD_POOL);

  const byId = new Map<string, MemoryRow>();
  for (const { row } of [...semantic, ...keyword]) byId.set(row.id, row);

  return fuseHybridChannels({
    entries: [...byId.values()],
    semantic: semantic.map((s) => ({ id: s.row.id, score: s.score })),
    keyword: keyword.map((k) => ({ id: k.row.id, score: k.score })),
    limit,
  });
}

export const memory = new Hono()
  .use('*', requireAuth)
  // Delta sync: upsert the pushed entries (LWW + text dedup), return the missing ones.
  .post('/sync', zValidator('json', MemorySyncRequestSchema), async (c) => {
    const { since, entries } = c.req.valid('json');
    const userId = c.get('userId');
    const now = Date.now();

    if (entries.length > 0) {
      // Re-embed every pushed text server-side (one batch), then upsert.
      const embeddings = await embedder.embed(entries.map((e) => e.text));

      const existing = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.userId, userId),
            or(
              inArray(
                memories.id,
                entries.map((e) => e.id),
              ),
              inArray(
                memories.text,
                entries.map((e) => e.text),
              ),
            ),
          ),
        );
      const byId = new Map(existing.map((r) => [r.id, r]));
      const byText = new Map(existing.map((r) => [r.text, r]));

      for (const [i, entry] of entries.entries()) {
        const embedding = embeddings[i]!;
        // Same id, or the same exact text under another id (the cross-device
        // duplicate) — both count as the same memory (server dedup).
        const twin = byId.get(entry.id) ?? byText.get(entry.text);

        if (twin) {
          // Last write wins on `updatedAt`; an older push never clobbers newer.
          if (entry.updatedAt > twin.updatedAt) {
            await db
              .update(memories)
              .set({
                text: entry.text,
                kind: entry.kind,
                importance: entry.importance,
                updatedAt: entry.updatedAt,
                source: entry.source ?? twin.source,
                embedding,
              })
              .where(and(eq(memories.userId, userId), eq(memories.id, twin.id)));
          }
          continue;
        }

        const row: MemoryRow = {
          id: entry.id,
          userId,
          text: entry.text,
          kind: entry.kind,
          importance: entry.importance,
          ts: entry.ts,
          updatedAt: entry.updatedAt,
          source: entry.source ?? null,
          embedding,
        };
        await db.insert(memories).values(row);
        // Later entries in this same batch dedup against what we just wrote.
        byId.set(row.id, row);
        byText.set(row.text, row);
      }
    }

    // Remote deltas the device is missing — everything changed since its cursor,
    // minus what it just pushed (no point echoing those back).
    const pushedIds = new Set(entries.map((e) => e.id));
    const remote = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.userId, userId),
          since === null ? undefined : gt(memories.updatedAt, since),
        ),
      )
      .orderBy(desc(memories.updatedAt))
      .limit(PULL_LIMIT);

    return c.json({
      ok: true,
      entries: remote.filter((r) => !pushedIds.has(r.id)).map(toWire),
      now,
    });
  })
  // Server hybrid recall — used by the desktop's cloud recall adapter.
  .get('/search', async (c) => {
    const q = c.req.query('q') ?? '';
    const limit = Math.min(
      Math.max(1, Number(c.req.query('limit')) || DEFAULT_SEARCH_LIMIT),
      MAX_SEARCH_LIMIT,
    );
    const rows = await searchMemories(c.get('userId'), q, limit);
    return c.json({ ok: true, entries: rows.map(toWire) });
  });
