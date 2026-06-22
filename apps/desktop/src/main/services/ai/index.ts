import { readConfig } from '../../infra/store.js';
import { createMockProvider } from '../../infra/ai/mock-provider.js';
import { createAnthropicProvider } from '../../infra/ai/anthropic-provider.js';
import { createAiService } from './ai-service.js';

/**
 * The wired AI service singleton the IPC layer calls. This is the one place that
 * couples the pure service to its concrete providers + the config reader (mirrors
 * how search-service wires its providers). `readConfig` is read fresh per call,
 * so toggling AI or switching providers in Settings takes effect immediately.
 */
export const aiService = createAiService({
  providers: {
    mock: createMockProvider(),
    anthropic: createAnthropicProvider(),
  },
  getConfig: readConfig,
});
