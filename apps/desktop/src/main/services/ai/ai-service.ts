import { WorkflowDraftSchema } from '@cockpitzero/shared';
import type { AiAnswer, AiProviderId, Config, WorkflowDraft } from '@cockpitzero/shared';
import type { AiProvider } from './provider.js';

/**
 * The AI use-case layer — the single place `ipc/index.ts` calls. It selects the
 * provider from `config.ai.provider`, short-circuits when AI is disabled, and is
 * fully dependency-injected (providers + a config reader), so it's unit-testable
 * with fakes and free of `electron`/network code. Config is read fresh on every
 * call so a Settings change (provider, enabled) takes effect without a restart.
 */

export interface AiServiceDeps {
  /** Provider implementations keyed by their config id. Total over `AiProviderId`
   *  so provider selection is exhaustive. */
  providers: Record<AiProviderId, AiProvider>;
  /** Reads the current config fresh (provider, enabled flag, tool grants, …). */
  getConfig: () => Config;
}

export interface AiStatus {
  enabled: boolean;
  provider: string;
  /** Enabled AND the selected provider is configured/reachable. */
  ok: boolean;
}

export interface AiService {
  ask(prompt: string): Promise<AiAnswer>;
  draftWorkflow(description: string): Promise<WorkflowDraft>;
  status(): AiStatus;
}

/** The answer returned when AI is turned off — never throws, so surfaces that
 *  call `askAI` without checking `enabled` degrade gracefully. */
function disabledAnswer(): AiAnswer {
  return {
    text: 'AI features are turned off. Enable them in Settings to ask the assistant.',
    meta: 'cockpit-ai · disabled',
    suggestions: [],
  };
}

export function createAiService({ providers, getConfig }: AiServiceDeps): AiService {
  return {
    async ask(prompt) {
      const ai = getConfig().ai;
      if (!ai.enabled) return disabledAnswer();
      return providers[ai.provider].ask(prompt, { settings: ai });
    },

    async draftWorkflow(description) {
      const ai = getConfig().ai;
      if (!ai.enabled) return { name: '', keyword: '', steps: [] };
      const draft = await providers[ai.provider].draftWorkflow(description, { settings: ai });
      // Never trust raw provider/model output — validate the structure (and each
      // step's action) before it reaches the renderer (CLAUDE.md: schemas are the
      // source of truth; the real provider emits model JSON we must not trust).
      return WorkflowDraftSchema.parse(draft);
    },

    status() {
      const ai = getConfig().ai;
      if (!ai.enabled) return { enabled: false, provider: ai.provider, ok: false };
      return {
        enabled: true,
        provider: ai.provider,
        ok: providers[ai.provider].ready({ settings: ai }),
      };
    },
  };
}
