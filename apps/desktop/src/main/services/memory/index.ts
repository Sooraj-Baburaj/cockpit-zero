import { generateObject } from 'ai';
import { AiMemoryFactsSchema, SecretName, providerInfo } from '@cockpitzero/shared';
import type { AiProviderId } from '@cockpitzero/shared';
import { readConfig } from '../../infra/store.js';
import { secretsService } from '../secrets/index.js';
import { buildLanguageModel } from '../../infra/ai/sdk-provider.js';
import { resolveEmbedder } from '../../infra/agent/embedder.js';
import {
  createLanceMemoryStore,
  migrateLegacyMemory,
} from '../../infra/agent/lance-memory-store.js';
import { createExtractor } from '../agent/extractor.js';
import { createMemoryService } from '../agent/memory-service.js';
import { authService, backendClient } from '../auth/index.js';
import { withCloudRecall } from './cloud-recall.js';

/**
 * The wired local memory engine singleton (production phase 5) — the one place that
 * couples the pure `MemoryService` to its concrete pieces: the LanceDB vector store,
 * the resolved embedder (on-device ONNX or provider), and the extractor (provider
 * `generateObject` with a keyless heuristic fallback). Mirrors how `ai/index` and
 * `agent/index` wire their services. `readConfig`/`secretsService.get` are read
 * fresh per call, so toggling memory, switching provider, or pasting a key takes
 * effect without a restart (the embedding *source*, which fixes the vector
 * dimension, is the one knob pinned at startup — see `resolveEmbedder`).
 *
 * Both the agent (`agent/index`) and the AI service (`ai/index`) import this single
 * instance, so the launcher, the agent loop, and the Console all see one memory.
 */

const EXTRACT_SYSTEM =
  'You distill a short exchange into durable, atomic memories worth recalling in ' +
  'future sessions. Extract only stable facts, preferences, commitments, or entities ' +
  '— never transient chit-chat, pleasantries, or the literal transcript. Each fact is ' +
  'one self-contained sentence in the third person. Assign a kind and an importance in ' +
  '[0,1]. Return an empty list when nothing is worth remembering.';

const getKey = (provider: AiProviderId) => secretsService.get(SecretName.providerKey(provider));

/**
 * Provider-backed extraction: build the configured model and ask for structured
 * facts. Throws (→ the extractor's keyless heuristic) whenever a real structured
 * provider isn't available: AI off, a non-SDK provider (`mock`/`managed`), or a
 * missing key/base URL. The memory service never trusts the raw object — it runs it
 * through the shared `coerceMemoryFacts`.
 */
async function extractWithProvider(rawText: string): Promise<unknown> {
  const ai = readConfig().ai;
  if (!ai.enabled) throw new Error('AI disabled — using heuristic extraction.');
  const info = providerInfo(ai.provider);
  if (!info) throw new Error('No structured-extraction provider configured.');
  const key = getKey(ai.provider);
  if (info.requiresKey && !key) throw new Error('No provider key — using heuristic extraction.');
  if (info.requiresBaseUrl && !ai.baseUrl?.trim()) throw new Error('No base URL configured.');

  const { object } = await generateObject({
    model: buildLanguageModel(ai, key),
    schema: AiMemoryFactsSchema,
    system: EXTRACT_SYSTEM,
    prompt: `Extract durable memories from this exchange:\n\n${rawText}`,
  });
  return object;
}

/** The LanceDB store + local embedder — exported for the P8 memory-sync wiring
 *  (`services/sync/index.ts`), which pushes/pulls entries against this same
 *  store and re-embeds pulled texts at the local dimension. */
export const store = createLanceMemoryStore();
export const embedder = resolveEmbedder(readConfig, getKey);

const localMemoryService = createMemoryService({
  store,
  embedder,
  extractor: createExtractor({ generate: extractWithProvider }),
  getConfig: readConfig,
});

/**
 * The app-facing memory service: the local engine + P8 cloud recall fusion. For
 * a signed-in user with `ai.memorySync` on, `recall` fuses local hits with the
 * backend's cloud memories and ingested knowledge (degrading to local-only when
 * offline/signed-out); every other method — writes, Console management — stays
 * purely local. Free/local users hit the local path unchanged.
 */
export const memoryService = withCloudRecall(localMemoryService, {
  http: backendClient,
  getToken: () => authService.token(),
  getConfig: readConfig,
});

let started = false;
/**
 * One-time startup: migrate a v1 `memory.json` into LanceDB. Called from the
 * composition root after `app` is ready (it touches `userData`). Best-effort and
 * idempotent — a failure is logged and the launcher continues.
 */
export async function initMemory(): Promise<void> {
  if (started) return;
  started = true;
  await migrateLegacyMemory(store, embedder);
}
