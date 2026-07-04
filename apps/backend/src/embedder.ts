import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createHashEmbedder } from '@cockpitzero/shared';
import type { Embedder } from '@cockpitzero/shared';
import { EMBEDDING_DIM } from './db/schema.js';
import { env } from './env.js';

/**
 * The server embedder (P8) behind the shared `Embedder` port. The server
 * **re-embeds everything** it stores (synced memories + knowledge chunks) so the
 * cloud pgvector index has one consistent dimension — devices never upload
 * vectors (their local dimension may differ; see the phase-8 risk note).
 *
 * With OPENAI_API_KEY set it uses the AI SDK's `embedMany` (the locked universal
 * provider); without one (dev, CI, tests) it degrades to the shared
 * deterministic hash embedder at the same dimension, so the pipeline — and every
 * `app.request` test — runs keyless.
 */
function createProviderEmbedder(apiKey: string): Embedder {
  const model = createOpenAI({ apiKey }).textEmbeddingModel(env.EMBEDDING_MODEL);
  return {
    dimensions: EMBEDDING_DIM,
    async embed(texts) {
      if (texts.length === 0) return [];
      const { embeddings } = await embedMany({ model, values: texts });
      return embeddings;
    },
  };
}

export const embedder: Embedder = env.OPENAI_API_KEY
  ? createProviderEmbedder(env.OPENAI_API_KEY)
  : createHashEmbedder(EMBEDDING_DIM);
