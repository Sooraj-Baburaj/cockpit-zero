import { z } from 'zod';

/**
 * Wire shapes for cloud memory + knowledge (production P8). These cross two
 * boundaries — desktop main ↔ backend (HTTP) and main ↔ renderer (IPC) — so the
 * schemas live here as the single source of truth; the backend validates every
 * request body/query with them. Everything is **opt-in + signed-in only**
 * (`ai.memorySync`): free/local users never produce these payloads.
 */

/** One synced memory on the wire — `MemoryRecord` minus nothing: embeddings never
 *  travel (the server re-embeds with its own model so the cloud index stays
 *  dimension-consistent, and the desktop re-embeds pulls with its local model). */
export const MemorySyncRecordSchema = z.object({
  id: z.string().min(1).max(128),
  /** Epoch ms it was first written. */
  ts: z.number().int().nonnegative(),
  /** Epoch ms it was last updated — the LWW conflict key. */
  updatedAt: z.number().int().nonnegative(),
  kind: z.string().min(1).max(64),
  text: z.string().min(1).max(4_000),
  importance: z.number().min(0).max(1),
  source: z.string().max(256).optional(),
});
export type MemorySyncRecord = z.infer<typeof MemorySyncRecordSchema>;

/** `POST /memory/sync` body: the local deltas since the device's last sync
 *  (`since: null` = first sync, push everything). */
export const MemorySyncRequestSchema = z.object({
  since: z.number().int().nonnegative().nullable(),
  entries: z.array(MemorySyncRecordSchema).max(1_000),
});
export type MemorySyncRequest = z.infer<typeof MemorySyncRequestSchema>;

/** `POST /memory/sync` response: the remote deltas the device is missing, plus
 *  the server clock to persist as the next `since`. */
export interface MemorySyncResponse {
  ok: boolean;
  entries: MemorySyncRecord[];
  /** Server epoch ms — the client stores it as its next `since` cursor. */
  now: number;
}

/** The IPC-facing result of one "sync now" (`memorySyncNow`). */
export interface MemorySyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  /** Epoch ms of this successful sync (the "last synced" label). */
  syncedAt?: number;
  error?: string;
}

/** What a knowledge upload contains. `pdf` is extracted server-side; `text`
 *  covers .txt/.md and anything already plain. */
export const KnowledgeSourceTypeSchema = z.enum(['pdf', 'text']);
export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;

/** Bound one upload to ~12 MB of raw bytes (base64 inflates 4/3). Large-document
 *  handling beyond that is a later refinement — the phase doc's "bound ingest
 *  size" risk item. */
export const KNOWLEDGE_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** `POST /knowledge` body: one document, base64-encoded. */
export const KnowledgeIngestRequestSchema = z.object({
  name: z.string().min(1).max(256),
  type: KnowledgeSourceTypeSchema,
  /** Base64 file bytes (bounded — see {@link KNOWLEDGE_MAX_UPLOAD_BYTES}). */
  content: z
    .string()
    .min(1)
    .max(Math.ceil((KNOWLEDGE_MAX_UPLOAD_BYTES * 4) / 3) + 4),
});
export type KnowledgeIngestRequest = z.infer<typeof KnowledgeIngestRequestSchema>;

/** One ingested document, as listed in the Console knowledge view. */
export interface KnowledgeDoc {
  docId: string;
  name: string;
  /** How many chunks the document was split into. */
  chunks: number;
  status: 'ready' | 'error';
  /** Epoch ms the document was ingested. */
  createdAt: number;
}

/** One knowledge search hit — a chunk plus its source document (for citation). */
export interface KnowledgeHit {
  docId: string;
  docName: string;
  chunk: string;
  score: number;
}
