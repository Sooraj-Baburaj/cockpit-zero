import { fuseHybridChannels } from '@cockpitzero/shared';
import type { Config, MemoryRecord, MemoryStats } from '@cockpitzero/shared';
import { cosineSimilarity, terms, type Embedder } from './embedder.js';
import type { Extractor } from './extractor.js';

/**
 * The local memory engine (production phase 5) — the real replacement for v1's
 * JSON keyword store. It accumulates *meaningful* memories (durable facts, not raw
 * transcripts) and recalls the most relevant ones for any prompt via **hybrid
 * recall**: semantic vector search fused with keyword overlap and a recency +
 * importance boost (Reciprocal Rank Fusion). Writes **dedup/merge** near-duplicates
 * instead of appending. Everything is on-device and **local + private** — entries
 * live under `userData` (LanceDB), NEVER in the synced `config.json`.
 *
 * Gated by `ai.memoryEnabled`: with memory off, `write`/`remember` are no-ops and
 * `recall` returns `[]`, so a caller honors the toggle without re-checking it. The
 * Console management surface (`stats`/`search`/`forget`/`clear`) stays available
 * regardless, so a user who turned memory off can still inspect and clear it.
 *
 * Dependency-inverted like the rest of the agent layer: the vector store, the
 * embedder, the extractor, and the config reader are all injected, so the whole
 * engine is unit-testable with fakes and free of `electron` / native modules.
 */

/** One remembered fact, with its `embedding` (the vector recall actually uses).
 *  Extends the IPC-facing {@link MemoryRecord} — the embedding stays main-process
 *  only and is stripped before crossing the bridge. */
export interface MemoryEntry extends MemoryRecord {
  embedding: number[];
}

/** A store hit paired with its similarity to the query (cosine, [-1, 1]). */
export interface ScoredEntry {
  entry: MemoryEntry;
  score: number;
}

/**
 * The persistence port — a LanceDB dataset in production (`infra/agent/
 * lance-memory-store.ts`), an in-memory map in tests / as the degrade fallback.
 * Async because LanceDB is; the in-memory impl just resolves immediately.
 */
export interface MemoryStore {
  /** Every entry (for the keyword channel + the Console recency list). */
  all(): Promise<MemoryEntry[]>;
  /** Insert or replace by id (dedup/merge writes the same id back). */
  upsert(entry: MemoryEntry): Promise<void>;
  /** The `k` nearest entries to `queryVec` by cosine, most-similar first. */
  vectorSearch(queryVec: number[], k: number): Promise<ScoredEntry[]>;
  /** Remove one entry by id; resolves whether it existed. */
  delete(id: string): Promise<boolean>;
  /** Drop everything. */
  clear(): Promise<void>;
}

export interface MemoryServiceDeps {
  store: MemoryStore;
  embedder: Embedder;
  extractor: Extractor;
  /** Reads config fresh, so toggling `memoryEnabled` takes effect at once. */
  getConfig: () => Config;
  now?: () => number;
  newId?: () => string;
}

export interface MemoryService {
  /** Whether memory is on right now (`ai.memoryEnabled`). */
  enabled(): boolean;
  /** Store one fact directly (embed → dedup/merge → upsert). Returns the stored
   *  entry, or null when memory is disabled / the text is empty. */
  write(text: string, kind?: string, source?: string): Promise<MemoryEntry | null>;
  /** Extract durable facts from a raw exchange and store each (the extraction
   *  entry point). Returns the stored entries; `[]` when disabled. */
  remember(rawText: string, source?: string): Promise<MemoryEntry[]>;
  /** Hybrid recall: semantic ∪ keyword, RRF-fused with recency + importance.
   *  `[]` when disabled. */
  recall(query: string, limit?: number): Promise<MemoryEntry[]>;
  /** Console search: hybrid for a query, most-recent-first for an empty query.
   *  Ungated (management). Embeddings are stripped from the returned records. */
  search(query: string, limit?: number): Promise<MemoryRecord[]>;
  /** Aggregate stats for the Console header (ungated). */
  stats(): Promise<MemoryStats>;
  /** Forget one entry by id (ungated management). */
  forget(id: string): Promise<{ ok: boolean }>;
  /** Clear all memory (ungated management). */
  clear(): Promise<{ ok: boolean }>;
}

const DEFAULT_LIMIT = 5;
const CONSOLE_LIMIT = 50;

/** Cosine at/above which a new fact is treated as a near-duplicate of an existing
 *  one → merge/update in place instead of appending a second row. */
const DEDUP_THRESHOLD = 0.9;

/** How many neighbors the semantic channel pulls before fusion (a small recall
 *  pool; the fused top-N is what surfaces). */
const SEMANTIC_POOL = 20;

/** Minimum cosine for a vector hit to count as a semantic match — keeps orthogonal
 *  / opposite vectors (which `vectorSearch` still returns to fill `k`) out of the
 *  fusion, so an unrelated entry only surfaces if it also overlaps on keywords. */
const SEMANTIC_FLOOR = 0;

/** Strip the (large, main-process-only) embedding before a record crosses IPC. */
function toRecord(entry: MemoryEntry): MemoryRecord {
  const { embedding: _embedding, ...record } = entry;
  return record;
}

export function createMemoryService({
  store,
  embedder,
  extractor,
  getConfig,
  now = () => Date.now(),
  newId = () => `mem_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
}: MemoryServiceDeps): MemoryService {
  const enabled = () => getConfig().ai.memoryEnabled;

  /** Embed one text (the batch API with a single input). */
  async function embedOne(text: string): Promise<number[]> {
    const [vec] = await embedder.embed([text]);
    return vec ?? [];
  }

  /**
   * Store one already-extracted fact: embed, find its nearest neighbor, and either
   * **merge** into it (when cosine ≥ threshold — keep the id/first-seen ts, bump
   * `updatedAt`, take the longer text, raise importance) or **insert** a new row.
   */
  async function storeFact(
    text: string,
    kind: string,
    importance: number,
    source: string | undefined,
  ): Promise<MemoryEntry> {
    const ts = now();
    const embedding = await embedOne(text);
    const [nearest] = await store.vectorSearch(embedding, 1);

    if (nearest && nearest.score >= DEDUP_THRESHOLD) {
      const prev = nearest.entry;
      // Prefer the more detailed phrasing; re-embed only if the text actually changed.
      const mergedText = text.length > prev.text.length ? text : prev.text;
      const mergedEmbedding =
        mergedText === prev.text ? prev.embedding : await embedOne(mergedText);
      const merged: MemoryEntry = {
        ...prev,
        text: mergedText,
        kind: prev.kind === 'note' ? kind : prev.kind,
        importance: Math.max(prev.importance, importance),
        updatedAt: ts,
        source: prev.source ?? source,
        embedding: mergedEmbedding,
      };
      await store.upsert(merged);
      return merged;
    }

    const entry: MemoryEntry = {
      id: newId(),
      ts,
      updatedAt: ts,
      kind,
      text,
      importance,
      source,
      embedding,
    };
    await store.upsert(entry);
    return entry;
  }

  /**
   * The hybrid ranking shared by `recall` (gated) and `search` (ungated): fuse the
   * semantic and keyword channels with RRF, add the recency + importance boosts,
   * and return the top `limit` entries. `[]` for an empty query / empty store.
   */
  async function hybrid(query: string, limit: number): Promise<MemoryEntry[]> {
    const wanted = terms(query);
    if (wanted.length === 0) return [];

    const all = await store.all();
    if (all.length === 0) return [];

    // Semantic channel: nearest neighbors by cosine, above the noise floor.
    const queryVec = await embedOne(query);
    const semantic = (
      await store.vectorSearch(queryVec, Math.min(SEMANTIC_POOL, all.length))
    ).filter((s) => s.score > SEMANTIC_FLOOR);

    // Keyword channel: term overlap over every entry (0-overlap entries excluded).
    const wantedSet = new Set(wanted);
    const keyword = all
      .map((entry) => {
        const have = new Set(terms(entry.text));
        let overlap = 0;
        for (const t of wantedSet) if (have.has(t)) overlap += 1;
        return { id: entry.id, score: overlap };
      })
      .filter((k) => k.score > 0);

    // RRF + recency/importance nudges — the fusion math is shared with the
    // backend's cloud recall (P8), so local and cloud rank identically.
    return fuseHybridChannels({
      entries: all,
      semantic: semantic.map((s) => ({ id: s.entry.id, score: s.score })),
      keyword,
      limit,
    });
  }

  return {
    enabled,

    async write(text, kind = 'note', source) {
      if (!enabled()) return null;
      const trimmed = text.trim();
      if (trimmed === '') return null;
      return storeFact(trimmed, kind, kind === 'note' ? 0.5 : 0.6, source);
    },

    async remember(rawText, source) {
      if (!enabled()) return [];
      const facts = await extractor.extract(rawText);
      const stored: MemoryEntry[] = [];
      // Sequential so each fact's dedup sees the ones written just before it (two
      // near-identical extracted facts collapse into one).
      for (const fact of facts) {
        stored.push(await storeFact(fact.text, fact.kind, fact.importance, source));
      }
      return stored;
    },

    async recall(query, limit = DEFAULT_LIMIT) {
      if (!enabled()) return [];
      return hybrid(query, limit);
    },

    async search(query, limit = CONSOLE_LIMIT) {
      const q = query.trim();
      if (q !== '') return (await hybrid(q, limit)).map(toRecord);
      // Empty query → the most-recently-updated entries (a browsable list).
      const all = await store.all();
      return all
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, Math.max(0, limit))
        .map(toRecord);
    },

    async stats() {
      const all = await store.all();
      const updatedAt = all.length === 0 ? null : Math.max(...all.map((e) => e.updatedAt));
      return { count: all.length, updatedAt, embeddingSource: getConfig().ai.embeddingSource };
    },

    async forget(id) {
      return { ok: await store.delete(id) };
    },

    async clear() {
      await store.clear();
      return { ok: true };
    },
  };
}

/**
 * A pure in-memory `MemoryStore` — the unit-test double and the **degrade
 * fallback** the LanceDB adapter falls back to if the native module fails to load,
 * so a vector-store failure never crashes the launcher (memory just doesn't
 * persist that session). Vector search is an exact cosine scan; fine for the small
 * local set, and identical semantics to LanceDB's ANN for our purposes.
 */
export function createInMemoryMemoryStore(seed: MemoryEntry[] = []): MemoryStore {
  let entries = new Map<string, MemoryEntry>(seed.map((e) => [e.id, e]));
  return {
    async all() {
      return [...entries.values()];
    },
    async upsert(entry) {
      entries.set(entry.id, entry);
    },
    async vectorSearch(queryVec, k) {
      return [...entries.values()]
        .map((entry) => ({ entry, score: cosineSimilarity(queryVec, entry.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(0, k));
    },
    async delete(id) {
      return entries.delete(id);
    },
    async clear() {
      entries = new Map();
    },
  };
}
