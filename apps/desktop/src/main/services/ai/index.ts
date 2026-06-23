import { SecretName } from '@cockpitzero/shared';
import type { AiProviderId } from '@cockpitzero/shared';
import { readConfig } from '../../infra/store.js';
import { createMockProvider } from '../../infra/ai/mock-provider.js';
import { createManagedProvider } from '../../infra/ai/managed-provider.js';
import { createSdkProvider } from '../../infra/ai/sdk-provider.js';
import { secretsService } from '../secrets/index.js';
import { memoryService } from '../memory/index.js';
import { createAiService } from './ai-service.js';

/**
 * The wired AI service singleton the IPC layer calls. This is the one place that
 * couples the pure service to its concrete providers + the config reader (mirrors
 * how search-service wires its providers). `readConfig` is read fresh per call, so
 * toggling AI or switching providers/models in the Console takes effect immediately.
 *
 * Every real BYOP provider is served by **one** universal SDK adapter (it branches on
 * `config.ai.provider` internally), reading the API key in-process from the secrets
 * vault — never `config.json` or the renderer (CLAUDE.md). `mock` stays for tests/CI
 * + the fresh-install fallback; `managed` is the reserved phase-9 slot.
 */
const sdk = createSdkProvider({
  getKey: (provider: AiProviderId) => secretsService.get(SecretName.providerKey(provider)),
});

export const aiService = createAiService({
  providers: {
    anthropic: sdk,
    openai: sdk,
    google: sdk,
    xai: sdk,
    mistral: sdk,
    groq: sdk,
    cohere: sdk,
    deepseek: sdk,
    'openai-compatible': sdk,
    managed: createManagedProvider(),
    mock: createMockProvider(),
  },
  getConfig: readConfig,
  // Recall feeds context into ask/askStream; the exchange is remembered after
  // (both gated by `ai.memoryEnabled`). The shared singleton so the agent loop,
  // the launcher, and the Console all read/write one memory.
  memory: memoryService,
});
