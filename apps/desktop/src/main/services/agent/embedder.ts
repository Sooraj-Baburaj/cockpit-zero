/**
 * The embedding port for the local memory engine (production phase 5). The
 * implementation moved to `@cockpitzero/shared` (`memory-fusion.ts`) in P8 so the
 * backend's cloud store shares the same vector math, hash fallback, and `terms`
 * tokenizer — this module stays as the agent layer's import site. The real
 * adapters (on-device transformers.js ONNX; the AI-SDK `embedMany`) live in
 * `infra/agent/` and are injected at the composition root.
 *
 * A text → a unit-length vector. Embeddings are produced in the **main process
 * only** (native model) and never cross the IPC bridge.
 */
export {
  cosineSimilarity,
  createHashEmbedder,
  l2normalize,
  terms,
  type Embedder,
} from '@cockpitzero/shared';
