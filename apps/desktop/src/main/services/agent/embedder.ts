/**
 * The embedding port for the local memory engine (production phase 5) and the
 * small amount of vector math the recall pipeline needs. Pure + `electron`-free
 * so the memory service is unit-testable with a fake embedder — the real adapters
 * (on-device transformers.js ONNX; the AI-SDK `embedMany`) live in `infra/agent/`
 * and are injected at the composition root.
 *
 * A text → a unit-length vector. Embeddings are produced in the **main process
 * only** (native model) and never cross the IPC bridge.
 */

/** Turns text into vectors. `dimensions` is fixed per embedder (and pins the
 *  store's vector width — switching source requires a memory rebuild). */
export interface Embedder {
  readonly dimensions: number;
  /** Embed a batch (one vector per input, same order). Batched so a provider
   *  adapter can use `embedMany` and the local model amortizes its load. */
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
 * overlap. That's exactly what makes it the safe **fallback** when the on-device
 * ONNX model can't load (recall still works, just without synonym reach) and a
 * convenient stand-in in unit tests. The real semantic quality comes from the
 * transformers.js / provider adapters in `infra/agent/`.
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
