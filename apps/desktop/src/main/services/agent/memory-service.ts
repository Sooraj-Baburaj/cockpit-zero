import type { Config } from '@cockpitzero/shared';

/**
 * The local memory store (Phase 7). Append + keyword-recall over short text
 * entries the assistant accumulates across sessions. It is **local + private**:
 * entries live under `userData` (see `infra/agent/memory-store.ts`), NEVER in the
 * synced `config.json`. The whole store is gated by `ai.memoryEnabled` — with
 * memory off, `write` is a no-op and `recall` returns `[]`, so a run honors the
 * toggle without each caller re-checking it.
 *
 * Dependency-inverted like the rest of the agent layer: the persistence adapter
 * (`MemoryStore`) and the config reader are injected, so this is unit-testable
 * with an in-memory fake and free of `electron`.
 */

/** One remembered fact. `embedding` is reserved for later semantic recall. */
export interface MemoryEntry {
  id: string;
  /** Epoch ms it was written. */
  ts: number;
  /** A coarse category, e.g. "task" / "note" / "session". */
  kind: string;
  text: string;
  embedding?: number[];
}

/** The persistence port — an in-memory fake in tests, a JSON file in production. */
export interface MemoryStore {
  all(): MemoryEntry[];
  append(entry: MemoryEntry): void;
}

export interface MemoryServiceDeps {
  store: MemoryStore;
  /** Reads the current config fresh, so toggling `memoryEnabled` takes effect at once. */
  getConfig: () => Config;
  now?: () => number;
  newId?: () => string;
}

export interface MemoryService {
  /** Whether memory is on right now (`ai.memoryEnabled`). */
  enabled(): boolean;
  /** Append a fact. Returns the stored entry, or null when memory is disabled. */
  write(text: string, kind?: string): MemoryEntry | null;
  /** Keyword recall: the top `limit` entries overlapping the query's terms,
   *  most-matching first, recency as the tiebreak. `[]` when disabled. */
  recall(query: string, limit?: number): MemoryEntry[];
}

const DEFAULT_LIMIT = 5;

/** Lowercase word tokens (length ≥ 2), deduped. The shared currency for scoring. */
function terms(text: string): string[] {
  const set = new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2),
  );
  return [...set];
}

export function createMemoryService({
  store,
  getConfig,
  now = () => Date.now(),
  newId = () => `mem_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
}: MemoryServiceDeps): MemoryService {
  const enabled = () => getConfig().ai.memoryEnabled;

  return {
    enabled,

    write(text, kind = 'note') {
      if (!enabled()) return null;
      const trimmed = text.trim();
      if (trimmed === '') return null;
      const entry: MemoryEntry = { id: newId(), ts: now(), kind, text: trimmed };
      store.append(entry);
      return entry;
    },

    recall(query, limit = DEFAULT_LIMIT) {
      if (!enabled()) return [];
      const wanted = terms(query);
      if (wanted.length === 0) return [];

      const scored = store
        .all()
        .map((entry) => {
          const have = new Set(terms(entry.text));
          const overlap = wanted.reduce((n, t) => n + (have.has(t) ? 1 : 0), 0);
          return { entry, overlap };
        })
        .filter((s) => s.overlap > 0)
        // More term overlap first; newer first as the tiebreak.
        .sort((a, b) => b.overlap - a.overlap || b.entry.ts - a.entry.ts);

      return scored.slice(0, Math.max(0, limit)).map((s) => s.entry);
    },
  };
}
