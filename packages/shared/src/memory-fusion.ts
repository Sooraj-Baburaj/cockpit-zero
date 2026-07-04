/**
 * The pure memory recall/scoring core (production P5 + P8). Everything here is
 * dependency-free math shared by BOTH memory stores — the desktop's local engine
 * (LanceDB, `apps/desktop/src/main/services/agent/memory-service.ts`) and the
 * backend's cloud store (pgvector, `apps/backend/src/routes/memory.ts`) — so the
 * two never drift on how hybrid recall ranks (P8's "don't duplicate the fusion
 * math"). The stores supply the channels (semantic + keyword scores); this module
 * fuses them (Reciprocal Rank Fusion + recency/importance nudges) and merges
 * already-ranked lists (local ∪ cloud ∪ knowledge).
 */

/** Turns text into vectors. `dimensions` is fixed per embedder (and pins the
 *  store's vector width — switching source requires a memory rebuild). */
export interface Embedder {
  readonly dimensions: number;
  /** Embed a batch (one vector per input, same order). Batched so a provider
   *  adapter can use `embedMany` and a local model amortizes its load. */
  embed(texts: string[]): Promise<number[][]>;
}

/** Cosine similarity in [-1, 1]. Robust to non-normalized inputs (divides by the
 *  norms), so it's correct whether or not the embedder pre-normalizes. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** L2-normalize a vector to unit length (no-op for a zero vector). */
export function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum);
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}

/** Lowercase word tokens (length ≥ 2), deduped — the shared currency for the
 *  keyword recall channel and the dependency-free hash embedder below. */
export function terms(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2),
    ),
  ];
}

/** djb2 — a small, stable string hash for bucketing tokens into vector slots. */
function hashToken(token: string): number {
  let h = 5381;
  for (let i = 0; i < token.length; i++) h = (h * 33) ^ token.charCodeAt(i);
  return h >>> 0;
}

/**
 * A deterministic, dependency-free embedder: hashes word tokens into a fixed-dim
 * bag-of-words vector (L2-normalized). It is **not** semantic — "deck" and
 * "presentation" stay orthogonal — so vector search degenerates to keyword
 * overlap. That's exactly what makes it the safe **fallback** when a real model
 * isn't available (the desktop's ONNX model failing to load; the backend running
 * without an embeddings key) and a convenient stand-in in unit tests.
 */
export function createHashEmbedder(dimensions = 256): Embedder {
  return {
    dimensions,
    async embed(texts) {
      return texts.map((text) => {
        const vec = new Array<number>(dimensions).fill(0);
        for (const token of terms(text)) {
          const slot = hashToken(token) % dimensions;
          vec[slot] = (vec[slot] ?? 0) + 1;
        }
        return l2normalize(vec);
      });
    },
  };
}

/** Reciprocal Rank Fusion constant — the standard 60 (dampens how much the very
 *  top of each list dominates, so channels combine smoothly). */
export const RRF_K = 60;

/** Recency/importance fine-boosts. Deliberately smaller than one RRF rank gap
 *  (adjacent ranks differ by ~1/60−1/61 ≈ 5e-4), so semantic + keyword agreement
 *  decides ordering and these only nudge genuinely close matches / break exact
 *  ties (newer + more important first). */
export const RECENCY_WEIGHT = 0.0001;
export const IMPORTANCE_WEIGHT = 0.0001;

/** One channel's verdict on one entry: any monotonic relevance score (cosine,
 *  keyword overlap, ts_rank, …) — only the *ordering* feeds the fusion. */
export interface ChannelScore {
  id: string;
  score: number;
}

/** The minimum shape fusion needs from an entry (both `MemoryRecord` and the
 *  backend's rows satisfy it). */
export interface FusionCandidate {
  id: string;
  /** Epoch ms of the last update — drives the recency nudge. */
  updatedAt: number;
  /** Salience in [0,1] — drives the importance nudge. */
  importance: number;
}

/**
 * Dense, tie-aware ranks over a score-sorted list: entries with equal score share
 * a rank. This is what lets recency genuinely break ties — two entries that score
 * identically on a channel get the same RRF contribution, so the recency boost
 * decides their order.
 */
export function rankWithTies(scored: ChannelScore[]): Map<string, number> {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const ranks = new Map<string, number>();
  let rank = 0;
  let prev: number | null = null;
  sorted.forEach((s, i) => {
    if (prev === null || s.score !== prev) rank = i;
    ranks.set(s.id, rank);
    prev = s.score;
  });
  return ranks;
}

/**
 * Hybrid fusion: combine a semantic and a keyword channel with RRF, add the
 * bounded recency + importance nudges, and return the top `limit` entries.
 * Entries in neither channel are excluded; recency is normalized across the
 * candidate set (newest = 1, oldest = 0) so the boost is deterministic
 * regardless of absolute timestamps.
 */
export function fuseHybridChannels<T extends FusionCandidate>(input: {
  entries: readonly T[];
  semantic: ChannelScore[];
  keyword: ChannelScore[];
  limit: number;
}): T[] {
  const { entries, semantic, keyword, limit } = input;
  const semanticRanks = rankWithTies(semantic);
  const keywordRanks = rankWithTies(keyword);

  const byId = new Map(entries.map((e) => [e.id, e]));
  const candidateIds = [...new Set([...semanticRanks.keys(), ...keywordRanks.keys()])].filter(
    (id) => byId.has(id),
  );
  if (candidateIds.length === 0) return [];

  const updatedAts = candidateIds.map((id) => byId.get(id)!.updatedAt);
  const minTs = Math.min(...updatedAts);
  const maxTs = Math.max(...updatedAts);
  const recencyNorm = (ts: number) => (maxTs === minTs ? 1 : (ts - minTs) / (maxTs - minTs));

  const fused = candidateIds.map((id) => {
    const entry = byId.get(id)!;
    const sRank = semanticRanks.get(id);
    const kRank = keywordRanks.get(id);
    let score = 0;
    if (sRank !== undefined) score += 1 / (RRF_K + sRank);
    if (kRank !== undefined) score += 1 / (RRF_K + kRank);
    score += RECENCY_WEIGHT * recencyNorm(entry.updatedAt);
    score += IMPORTANCE_WEIGHT * entry.importance;
    return { entry, score };
  });

  // Highest fused score first; newer (then higher importance) breaks exact ties.
  fused.sort(
    (a, b) =>
      b.score - a.score ||
      b.entry.updatedAt - a.entry.updatedAt ||
      b.entry.importance - a.entry.importance,
  );
  return fused.slice(0, Math.max(0, limit)).map((f) => f.entry);
}

/**
 * Merge several already-ranked result lists (e.g. local recall ∪ cloud recall ∪
 * knowledge hits) into one, RRF over each list's positions, deduped by `key`
 * (the first list containing a key supplies its item — so with shared ids the
 * local copy wins over its cloud twin). This is P8's "fuse *results*, not raw
 * vectors": the lists come from stores with different embedding dimensions.
 */
export function fuseRankedLists<T>(
  lists: ReadonlyArray<readonly T[]>,
  key: (item: T) => string,
  limit: number,
): T[] {
  const fused = new Map<string, { item: T; score: number }>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const k = key(item);
      const prev = fused.get(k);
      const score = 1 / (RRF_K + rank);
      if (prev) prev.score += score;
      else fused.set(k, { item, score });
    });
  }
  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit))
    .map((f) => f.item);
}
