import { SecretName } from '@cockpitzero/shared';
import type { AiProviderId, AiUsageSummary } from '@cockpitzero/shared';
import { readConfig } from '../../infra/store.js';
import { createMockProvider } from '../../infra/ai/mock-provider.js';
import { createManagedProvider } from '../../infra/ai/managed-provider.js';
import { createSdkProvider } from '../../infra/ai/sdk-provider.js';
import { secretsService } from '../secrets/index.js';
import { memoryService } from '../memory/index.js';
import { authService, backendClient } from '../auth/index.js';
import { createChatStore } from '../../infra/chat-store.js';
import { createAiService } from './ai-service.js';
import { createChatService } from './chat-service.js';

/**
 * The wired AI service singleton the IPC layer calls. This is the one place that
 * couples the pure service to its concrete providers + the config reader (mirrors
 * how search-service wires its providers). `readConfig` is read fresh per call, so
 * toggling AI or switching providers/models in the Console takes effect immediately.
 *
 * Every real BYOP provider is served by **one** universal SDK adapter (it branches on
 * `config.ai.provider` internally), reading the API key in-process from the secrets
 * vault — never `config.json` or the renderer (CLAUDE.md). `mock` stays for tests/CI
 * + the fresh-install fallback; `managed` (P9) proxies through our backend with the
 * vault session token — no client-side key, the server's router picks the model.
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
    managed: createManagedProvider({
      http: backendClient,
      getToken: () => authService.token(),
      getPlan: () => authService.plan(),
    }),
    mock: createMockProvider(),
  },
  getConfig: readConfig,
  // Recall feeds context into ask/askStream; the exchange is remembered after
  // (both gated by `ai.memoryEnabled`). The shared singleton so the agent loop,
  // the launcher, and the Console all read/write one memory.
  memory: memoryService,
});

/** The AI chat window's session service — persists to `userData/chats.json` and
 *  answers over the same streamed ask (provider + memory) the launcher uses. */
export const chatService = createChatService({
  store: createChatStore(),
  ask: (prompt, onDelta, signal) => aiService.askStream(prompt, onDelta, signal),
});

/** Managed-usage read for the Console (`aiUsage` IPC): the backend's per-user
 *  meter for the current period. Signed-out (or unreachable) resolves a zeroed
 *  `{ ok: false }` — the panel shows the sign-in nudge, nothing throws. */
export async function fetchAiUsage(): Promise<AiUsageSummary> {
  const empty = { period: '', requests: 0, inputTokens: 0, outputTokens: 0 };
  const token = authService.token();
  if (!token) return { ok: false, ...empty, error: 'Sign in to see your AI usage.' };
  try {
    const res = await backendClient.request('/usage', { token });
    if (!res.ok) return { ok: false, ...empty, error: `Usage read failed (${res.status}).` };
    return (await res.json()) as AiUsageSummary;
  } catch (err) {
    return { ok: false, ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}
