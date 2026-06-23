import { app } from 'electron';
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { Connection, Table } from '@lancedb/lancedb';
import {
  createInMemoryMemoryStore,
  type MemoryEntry,
  type MemoryStore,
  type ScoredEntry,
} from '../../services/agent/memory-service.js';
import type { Embedder } from '../../services/agent/embedder.js';

/**
 * The LanceDB-backed `MemoryStore` (production phase 5) — the on-disk vector store
 * for the local memory engine, replacing v1's `memory.json`. A LanceDB dataset
 * under `userData/memory.lance/` holds each fact's vector + metadata + text;
 * recall does an embedded cosine ANN search. **Main process only** — LanceDB is a
 * native module; never import this from the renderer.
 *
 * | macOS   | ~/Library/Application Support/CockpitZero/memory.lance/ |
 * | Windows | %APPDATA%/CockpitZero/memory.lance/                     |
 * | Linux   | ~/.config/CockpitZero/memory.lance/                     |
 *
 * Resilience first (the launcher must never crash on a memory failure): the native
 * module is **dynamically imported** and the path resolved lazily (after `app` is
 * ready). If LanceDB fails to load/open at any point, the store **degrades to an
 * in-memory set** for the session — memory just doesn't persist, the bar stays up.
 */

/** The dataset directory + table name (a LanceDB dir holds one or more tables). */
const DATASET_DIR = 'memory.lance';
const TABLE_NAME = 'memory';

/** A LanceDB row mirrors {@link MemoryEntry} with the vector under `vector`. */
interface LanceRow {
  id: string;
  vector: number[];
  text: string;
  kind: string;
  ts: number;
  updatedAt: number;
  importance: number;
  /** LanceDB has no nullable-string sugar here; we store '' for "no source". */
  source: string;
}

/** Build the LanceDB row payload (typed `Record` so it satisfies the SDK's `Data`). */
function toRow(entry: MemoryEntry): Record<string, unknown> {
  return {
    id: entry.id,
    vector: entry.embedding,
    text: entry.text,
    kind: entry.kind,
    ts: entry.ts,
    updatedAt: entry.updatedAt,
    importance: entry.importance,
    source: entry.source ?? '',
  };
}

function fromRow(row: LanceRow): MemoryEntry {
  return {
    id: row.id,
    ts: row.ts,
    updatedAt: row.updatedAt,
    kind: row.kind,
    text: row.text,
    importance: row.importance,
    source: row.source === '' ? undefined : row.source,
    embedding: Array.from(row.vector),
  };
}

/** SQL-escape a string id for LanceDB's `delete`/predicate filters. */
function quote(id: string): string {
  return `'${id.replace(/'/g, "''")}'`;
}

export function createLanceMemoryStore(): MemoryStore {
  // The degrade target — also where rows land if LanceDB can't be loaded/opened.
  const fallback = createInMemoryMemoryStore();
  let degraded = false;

  let connPromise: Promise<Connection> | null = null;
  /** The table once it exists. Null until the first upsert creates it (LanceDB
   *  infers the vector dimension from the first row's `vector`). */
  let table: Table | null = null;

  const datasetPath = () => join(app.getPath('userData'), DATASET_DIR);

  async function connect(): Promise<Connection> {
    // Indirect dynamic import: native module, main-process only, loaded lazily so a
    // missing/incompatible binary degrades instead of crashing at module-eval time.
    const lancedb = await import('@lancedb/lancedb');
    return (connPromise ??= lancedb.connect(datasetPath()));
  }

  /** Open the table if it already exists on disk; leave `table` null otherwise. */
  async function openExisting(): Promise<void> {
    const db = await connect();
    const names = await db.tableNames();
    if (names.includes(TABLE_NAME)) table = await db.openTable(TABLE_NAME);
  }

  /** Mark the store degraded (log once) and route everything to the fallback. */
  function degrade(err: unknown): void {
    if (!degraded) {
      degraded = true;
      console.error('[memory] LanceDB unavailable — using in-memory store this session.', err);
    }
  }

  let opened: Promise<void> | null = null;
  /** Ensure we've attempted to open an existing table exactly once. */
  async function ensureOpened(): Promise<void> {
    if (degraded) return;
    try {
      await (opened ??= openExisting());
    } catch (err) {
      degrade(err);
    }
  }

  return {
    async all() {
      if (degraded) return fallback.all();
      await ensureOpened();
      if (degraded || !table) return degraded ? fallback.all() : [];
      try {
        const rows = (await table.query().toArray()) as LanceRow[];
        return rows.map(fromRow);
      } catch (err) {
        degrade(err);
        return fallback.all();
      }
    },

    async upsert(entry) {
      if (degraded) return fallback.upsert(entry);
      await ensureOpened();
      if (degraded) return fallback.upsert(entry);
      try {
        const db = await connect();
        const row = toRow(entry);
        if (!table) {
          // First write creates the table (and fixes the vector dimension from it).
          table = await db.createTable(TABLE_NAME, [row]);
          return;
        }
        // Upsert by id: replace a matching row, else insert (the dedup/merge path
        // writes the same id back, so this collapses duplicates).
        await table
          .mergeInsert('id')
          .whenMatchedUpdateAll()
          .whenNotMatchedInsertAll()
          .execute([row]);
      } catch (err) {
        degrade(err);
        return fallback.upsert(entry);
      }
    },

    async vectorSearch(queryVec, k) {
      if (degraded) return fallback.vectorSearch(queryVec, k);
      await ensureOpened();
      if (degraded || !table) return degraded ? fallback.vectorSearch(queryVec, k) : [];
      try {
        const rows = (await table
          .query()
          .nearestTo(queryVec)
          .distanceType('cosine')
          .limit(Math.max(1, k))
          .toArray()) as Array<LanceRow & { _distance: number }>;
        // LanceDB cosine distance = 1 − cosine similarity; convert back to a score.
        return rows.map<ScoredEntry>((row) => ({
          entry: fromRow(row),
          score: 1 - row._distance,
        }));
      } catch (err) {
        degrade(err);
        return fallback.vectorSearch(queryVec, k);
      }
    },

    async delete(id) {
      if (degraded) return fallback.delete(id);
      await ensureOpened();
      if (degraded || !table) return degraded ? fallback.delete(id) : false;
      try {
        await table.delete(`id = ${quote(id)}`);
        return true;
      } catch (err) {
        degrade(err);
        return fallback.delete(id);
      }
    },

    async clear() {
      if (degraded) return fallback.clear();
      await ensureOpened();
      if (degraded) return fallback.clear();
      try {
        if (!table) return;
        const db = await connect();
        await db.dropTable(TABLE_NAME);
        table = null;
      } catch (err) {
        degrade(err);
        return fallback.clear();
      }
    },
  };
}

/** The v1 on-disk shape (`infra/agent/memory-store.ts`): entries with no vector. */
interface LegacyMemoryEntry {
  id: string;
  ts: number;
  kind: string;
  text: string;
  embedding?: number[];
}
interface LegacyMemoryFile {
  version: 1;
  entries: LegacyMemoryEntry[];
}

/**
 * One-time migration of a v1 `memory.json` into LanceDB (production phase 5). On
 * first run, if the old file exists, embed each entry's text (the v1 `embedding`
 * field was reserved/unused) and upsert it, then rename the file to
 * `memory.json.migrated` so the import never repeats. Best-effort: a failure is
 * logged and the launcher continues (memory simply starts fresh).
 */
export async function migrateLegacyMemory(store: MemoryStore, embedder: Embedder): Promise<void> {
  const jsonPath = join(app.getPath('userData'), 'memory.json');
  if (!existsSync(jsonPath)) return;
  try {
    const raw = JSON.parse(readFileSync(jsonPath, 'utf8')) as Partial<LegacyMemoryFile>;
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    for (const old of entries) {
      const text = (old.text ?? '').trim();
      if (text === '') continue;
      const [embedding] = await embedder.embed([text]);
      const entry: MemoryEntry = {
        id: old.id,
        ts: old.ts,
        updatedAt: old.ts,
        kind: old.kind || 'note',
        text,
        importance: 0.5,
        source: 'import',
        embedding: embedding ?? [],
      };
      await store.upsert(entry);
    }
    // Rename so the import is one-time (and the old data stays recoverable).
    renameSync(jsonPath, `${jsonPath}.migrated`);
    console.info(`[memory] migrated ${entries.length} entries from memory.json into LanceDB.`);
  } catch (err) {
    console.error('[memory] memory.json migration failed — starting with a fresh store.', err);
  }
}
