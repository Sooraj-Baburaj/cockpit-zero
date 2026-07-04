import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, asc, cosineDistance, count, desc, eq, sql } from 'drizzle-orm';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import {
  KNOWLEDGE_MAX_UPLOAD_BYTES,
  KnowledgeIngestRequestSchema,
  fuseHybridChannels,
} from '@cockpitzero/shared';
import type { KnowledgeDoc, KnowledgeHit } from '@cockpitzero/shared';
import { db } from '../db/index.js';
import { documents, knowledge } from '../db/schema.js';
import { embedder } from '../embedder.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Personal knowledge base (P8): user-initiated document ingestion for signed-in
 * users. Upload (base64) → extract (unpdf for PDFs — a maintained extractor, per
 * the phase doc's "don't hand-roll a PDF parser") → chunk (langchain's
 * `RecursiveCharacterTextSplitter` — a maintained chunker) → **server-embed** →
 * store as `knowledge` rows under a `documents` job row. Search mirrors the
 * memory route's hybrid recall (pgvector + FTS + the shared fusion math) and
 * returns the source document name so answers can cite it. Removal is a real
 * delete — the document row cascades to its chunks.
 */

/** Chunking tuned for citation-sized passages (roughly a paragraph or two). */
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 150;
/** Hard cap so one giant document can't monopolize the index / embedding spend. */
const MAX_CHUNKS = 2_000;
/** Provider embedding batch size (bounds one `embedMany` request). */
const EMBED_BATCH = 64;

const SEMANTIC_POOL = 20;
const KEYWORD_POOL = 50;
const SEMANTIC_FLOOR = 0;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 50;

/** Knowledge chunks carry no per-entry salience — a flat mid importance keeps the
 *  shared fusion's importance nudge neutral between chunks. */
const CHUNK_IMPORTANCE = 0.5;

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Extract plain text from an upload (PDF via unpdf, everything else UTF-8). */
async function extractPlainText(type: 'pdf' | 'text', bytes: Buffer): Promise<string> {
  if (type === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  return bytes.toString('utf8');
}

export const knowledgeRoute = new Hono()
  .use('*', requireAuth)
  // Ingest one document: extract → chunk → embed → store.
  .post('/', zValidator('json', KnowledgeIngestRequestSchema), async (c) => {
    const { name, type, content } = c.req.valid('json');
    const userId = c.get('userId');

    const bytes = Buffer.from(content, 'base64');
    if (bytes.byteLength === 0 || bytes.byteLength > KNOWLEDGE_MAX_UPLOAD_BYTES) {
      return c.json({ ok: false, error: 'Document is empty or too large.' }, 413);
    }

    let text: string;
    try {
      text = (await extractPlainText(type, bytes)).trim();
    } catch {
      return c.json({ ok: false, error: `Could not extract text from “${name}”.` }, 422);
    }
    if (text === '') {
      return c.json({ ok: false, error: `No extractable text in “${name}”.` }, 422);
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    const chunks = (await splitter.splitText(text)).slice(0, MAX_CHUNKS);

    const docId = newId('doc');
    const now = Date.now();
    await db.insert(documents).values({
      id: docId,
      userId,
      name,
      source: `upload:${type}`,
      status: 'ready',
      createdAt: now,
    });

    // Embed + insert in bounded batches so a large document streams through
    // instead of one giant provider request / insert.
    for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
      const batch = chunks.slice(start, start + EMBED_BATCH);
      const embeddings = await embedder.embed(batch);
      await db.insert(knowledge).values(
        batch.map((chunk, i) => ({
          id: newId('kn'),
          userId,
          docId,
          seq: start + i,
          chunk,
          embedding: embeddings[i]!,
          updatedAt: now,
        })),
      );
    }

    return c.json({ ok: true, docId, chunks: chunks.length });
  })
  // The user's ingested documents, newest first, with chunk counts.
  .get('/', async (c) => {
    const userId = c.get('userId');
    const rows = await db
      .select({
        docId: documents.id,
        name: documents.name,
        status: documents.status,
        createdAt: documents.createdAt,
        chunks: count(knowledge.id),
      })
      .from(documents)
      .leftJoin(knowledge, eq(knowledge.docId, documents.id))
      .where(eq(documents.userId, userId))
      .groupBy(documents.id)
      .orderBy(desc(documents.createdAt));
    const docs: KnowledgeDoc[] = rows.map((r) => ({ ...r, chunks: Number(r.chunks) }));
    return c.json({ ok: true, docs });
  })
  // Hybrid recall over the knowledge chunks (same shared fusion as memories).
  .get('/search', async (c) => {
    const userId = c.get('userId');
    const q = (c.req.query('q') ?? '').trim();
    const limit = Math.min(
      Math.max(1, Number(c.req.query('limit')) || DEFAULT_SEARCH_LIMIT),
      MAX_SEARCH_LIMIT,
    );
    if (q === '') return c.json({ ok: true, hits: [] as KnowledgeHit[] });

    const [queryVec] = await embedder.embed([q]);
    if (!queryVec) return c.json({ ok: true, hits: [] as KnowledgeHit[] });

    const distance = cosineDistance(knowledge.embedding, queryVec);
    const semanticRows = await db
      .select({
        id: knowledge.id,
        chunk: knowledge.chunk,
        docId: knowledge.docId,
        docName: documents.name,
        updatedAt: knowledge.updatedAt,
        score: sql<number>`1 - (${distance})`,
      })
      .from(knowledge)
      .innerJoin(documents, eq(documents.id, knowledge.docId))
      .where(eq(knowledge.userId, userId))
      .orderBy(asc(distance))
      .limit(SEMANTIC_POOL);
    const semantic = semanticRows.filter((s) => s.score > SEMANTIC_FLOOR);

    const tsQuery = sql`plainto_tsquery('english', ${q})`;
    const keyword = await db
      .select({
        id: knowledge.id,
        chunk: knowledge.chunk,
        docId: knowledge.docId,
        docName: documents.name,
        updatedAt: knowledge.updatedAt,
        score: sql<number>`ts_rank(to_tsvector('english', ${knowledge.chunk}), ${tsQuery})`,
      })
      .from(knowledge)
      .innerJoin(documents, eq(documents.id, knowledge.docId))
      .where(
        and(
          eq(knowledge.userId, userId),
          sql`to_tsvector('english', ${knowledge.chunk}) @@ ${tsQuery}`,
        ),
      )
      .limit(KEYWORD_POOL);

    const byId = new Map<string, (typeof semanticRows)[number]>();
    for (const row of [...semantic, ...keyword]) byId.set(row.id, row);

    const fused = fuseHybridChannels({
      entries: [...byId.values()].map((r) => ({ ...r, importance: CHUNK_IMPORTANCE })),
      semantic: semantic.map((s) => ({ id: s.id, score: s.score })),
      keyword: keyword.map((k) => ({ id: k.id, score: k.score })),
      limit,
    });

    const hits: KnowledgeHit[] = fused.map((f) => ({
      docId: f.docId,
      docName: f.docName,
      chunk: f.chunk,
      score: f.score,
    }));
    return c.json({ ok: true, hits });
  })
  // Remove one document — a REAL delete (chunks cascade with the row).
  .delete('/:docId', async (c) => {
    const userId = c.get('userId');
    const docId = c.req.param('docId');
    const deleted = await db
      .delete(documents)
      .where(and(eq(documents.id, docId), eq(documents.userId, userId)))
      .returning({ id: documents.id });
    return c.json({ ok: deleted.length > 0 });
  });
