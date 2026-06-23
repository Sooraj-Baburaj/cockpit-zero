import { WorkflowDraftSchema, providerLabel, rankDigestItems } from '@cockpitzero/shared';
import type {
  AiAnswer,
  AiProviderId,
  Config,
  DigestRanking,
  DigestSourceItem,
  DigestSummarizeOptions,
  WorkflowDraft,
} from '@cockpitzero/shared';
import type { AiProvider } from './provider.js';

/**
 * The AI use-case layer — the single place `ipc/index.ts` calls. It selects the
 * provider from `config.ai.provider`, short-circuits when AI is disabled, and is
 * fully dependency-injected (providers + a config reader), so it's unit-testable
 * with fakes and free of `electron`/network code. Config is read fresh on every
 * call so a config change (provider, enabled) takes effect without a restart.
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
  /** Summarize + rank a routine's notifications (Phase 5). When AI is disabled it
   *  falls back to the deterministic local ranker so the digest still works. */
  summarizeDigest(
    items: DigestSourceItem[],
    opts: DigestSummarizeOptions,
  ): Promise<DigestRanking[]>;
  status(): AiStatus;
}

/** The answer returned when AI is turned off — never throws, so surfaces that
 *  call `askAI` without checking `enabled` degrade gracefully. */
function disabledAnswer(): AiAnswer {
  return {
    text: 'AI features are turned off. Enable them in the Console to ask the assistant.',
    meta: 'cockpit-ai · disabled',
    suggestions: [],
  };
}

/** The answer when AI is on but the selected provider isn't configured yet (no key /
 *  no model). We never silently fabricate a real-looking answer here — the surface
 *  shows a clear "connect a provider" nudge instead (production phase 3). */
function unconfiguredAnswer(provider: AiProviderId): AiAnswer {
  const text =
    provider === 'managed'
      ? 'Managed AI isn’t available yet. Pick your own provider and paste a key in the Console → AI.'
      : `Connect ${providerLabel(provider)} in the Console → AI — choose a model and paste your API key to start asking.`;
  return { text, meta: 'cockpit-ai · not connected', suggestions: [] };
}

export function createAiService({ providers, getConfig }: AiServiceDeps): AiService {
  return {
    async ask(prompt) {
      const ai = getConfig().ai;
      if (!ai.enabled) return disabledAnswer();
      const provider = providers[ai.provider];
      // Real provider selected but not configured (no key/model) → nudge, don't
      // fabricate. The `mock` default stays ready, so a fresh install still renders.
      if (!provider.ready({ settings: ai })) return unconfiguredAnswer(ai.provider);
      return provider.ask(prompt, { settings: ai });
    },

    async draftWorkflow(description) {
      const ai = getConfig().ai;
      if (!ai.enabled) return { name: '', keyword: '', steps: [] };
      const provider = providers[ai.provider];
      if (!provider.ready({ settings: ai })) {
        throw new Error(
          `Connect ${providerLabel(ai.provider)} in the Console → AI before drafting a workflow.`,
        );
      }
      const draft = await provider.draftWorkflow(description, { settings: ai });
      // Never trust raw provider/model output — validate the structure (and each
      // step's action) before it reaches the renderer (CLAUDE.md: schemas are the
      // source of truth; the real provider emits model JSON we must not trust).
      return WorkflowDraftSchema.parse(draft);
    },

    async summarizeDigest(items, opts) {
      const ai = getConfig().ai;
      // Local-first: with AI off, no items, or an unconfigured provider, rank
      // deterministically on-device — no model call, the digest still surfaces.
      // Otherwise the selected provider does the summarize + rank.
      if (!ai.enabled || items.length === 0) return rankDigestItems(items, opts);
      const provider = providers[ai.provider];
      if (!provider.ready({ settings: ai })) return rankDigestItems(items, opts);
      return provider.summarizeDigest(items, opts, { settings: ai });
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
