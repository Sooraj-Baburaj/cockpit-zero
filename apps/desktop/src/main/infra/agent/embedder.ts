import { app } from 'electron';
import { join } from 'node:path';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createCohere } from '@ai-sdk/cohere';
import type { AiProviderId, AiSettings } from '@cockpitzero/shared';
import { createHashEmbedder, type Embedder } from '../../services/agent/embedder.js';

/**
 * The concrete embedding adapters for the local memory engine (production phase 5),
 * behind the pure `Embedder` port. **Main process only** — the on-device model is a
 * native ONNX runtime; never import this from the renderer.
 *
 * Two sources, selected by `ai.embeddingSource`:
 *  - `local`  → transformers.js (ONNX, `Xenova/all-MiniLM-L6-v2`, 384-dim). No key,
 *               offline after the first model fetch. The keyless default.
 *  - `provider` → the configured provider's embedding model via the AI SDK
 *               (`embedMany`). Higher quality, needs a key; only providers that ship
 *               an embedding API qualify — anything else falls back to local.
 *
 * Resilience: the local model is dynamically imported and, if it can't load (missing
 * ONNX binary, offline first-run), the embedder **degrades to a keyword hash
 * embedder of the same dimension** — recall keeps working (without synonym reach)
 * and the launcher never crashes.
 */

/** The local ONNX model + its fixed output dimension. */
const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';
const LOCAL_DIM = 384;

/** Minimal shape of the transformers.js feature-extraction pipeline we use. */
type FeaturePipeline = (
  texts: string[],
  opts: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

/**
 * The on-device embedder. Lazily loads the model on first use (cached under
 * `userData/models`), then mean-pools + normalizes a batch. On any load/run failure
 * it logs once and serves a same-dimension keyword hash vector instead.
 */
export function createLocalEmbedder(): Embedder {
  const fallback = createHashEmbedder(LOCAL_DIM);
  let pipe: Promise<FeaturePipeline> | null = null;
  let degraded = false;

  async function loadPipeline(): Promise<FeaturePipeline> {
    // Indirect dynamic import: native module, lazy so a missing binary degrades
    // rather than crashing at module-eval time.
    const transformers = await import('@huggingface/transformers');
    // Cache model weights under userData so first-run is the only download.
    transformers.env.cacheDir = join(app.getPath('userData'), 'models');
    return (await transformers.pipeline(
      'feature-extraction',
      LOCAL_MODEL,
    )) as unknown as FeaturePipeline;
  }

  return {
    dimensions: LOCAL_DIM,
    async embed(texts) {
      if (texts.length === 0) return [];
      if (degraded) return fallback.embed(texts);
      try {
        const extractor = await (pipe ??= loadPipeline());
        const output = await extractor(texts, { pooling: 'mean', normalize: true });
        return output.tolist();
      } catch (err) {
        console.error('[memory] local embedder failed — degrading to keyword vectors.', err);
        degraded = true;
        return fallback.embed(texts);
      }
    },
  };
}

/** Providers that ship an embedding API + their default model and output dim. */
const PROVIDER_EMBEDDING: Partial<Record<AiProviderId, { model: string; dim: number }>> = {
  openai: { model: 'text-embedding-3-small', dim: 1536 },
  google: { model: 'text-embedding-004', dim: 768 },
  mistral: { model: 'mistral-embed', dim: 1024 },
  cohere: { model: 'embed-english-v3.0', dim: 1024 },
};

/** Build the AI-SDK embedding model for a provider that supports embeddings. */
function embeddingModel(provider: AiProviderId, modelId: string, key: string) {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: key }).textEmbeddingModel(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: key }).textEmbeddingModel(modelId);
    case 'mistral':
      return createMistral({ apiKey: key }).textEmbeddingModel(modelId);
    case 'cohere':
      return createCohere({ apiKey: key }).textEmbeddingModel(modelId);
    default:
      return null;
  }
}

/**
 * A provider-backed embedder via the AI SDK's `embedMany`, or null when the
 * selected provider has no embedding API / no key. Higher quality than local, at
 * the cost of a key + network.
 */
export function createSdkEmbedder(settings: AiSettings, key: string | null): Embedder | null {
  const spec = PROVIDER_EMBEDDING[settings.provider];
  if (!spec || !key) return null;
  const model = embeddingModel(settings.provider, spec.model, key);
  if (!model) return null;
  return {
    dimensions: spec.dim,
    async embed(texts) {
      if (texts.length === 0) return [];
      const { embeddings } = await embedMany({ model, values: texts });
      return embeddings;
    },
  };
}

/**
 * Resolve the embedder for the current config: provider embeddings when the user
 * opted in (`embeddingSource: 'provider'`) and the provider supports them with a
 * key; on-device ONNX otherwise. Resolved once at startup — switching source needs
 * a restart + memory rebuild (the dataset is pinned to its creation-time dimension).
 */
export function resolveEmbedder(
  getConfig: () => { ai: AiSettings },
  getKey: (provider: AiProviderId) => string | null,
): Embedder {
  const ai = getConfig().ai;
  if (ai.embeddingSource === 'provider') {
    const sdk = createSdkEmbedder(ai, getKey(ai.provider));
    if (sdk) return sdk;
  }
  return createLocalEmbedder();
}
