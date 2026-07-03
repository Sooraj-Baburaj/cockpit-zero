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
import type { MemoryService } from '../agent/memory-service.js';

/**
 * The AI use-case layer — the single place `ipc/index.ts` calls. It selects the
 * provider from `config.ai.provider`, short-circuits when AI is disabled, and is
 * fully dependency-injected (providers + a config reader + the memory engine), so
 * it's unit-testable with fakes and free of `electron`/network code. Config is read
 * fresh on every call so a config change (provider, enabled) takes effect without a
 * restart.
 *
 * Memory (production phase 5): when a real provider answers, recalled context is
 * prepended to the prompt and the salient exchange is remembered afterward — both
 * gated by `ai.memoryEnabled` (the memory service no-ops when off). The dependency
 * is optional so the service still constructs in tests without it.
 */

export interface AiServiceDeps {
  /** Provider implementations keyed by their config id. Total over `AiProviderId`
   *  so provider selection is exhaustive. */
  providers: Record<AiProviderId, AiProvider>;
  /** Reads the current config fresh (provider, enabled flag, tool grants, …). */
  getConfig: () => Config;
  /** The local memory engine — recall feeds context into `ask`/`askStream`, and the
   *  exchange is remembered after a successful answer. Optional (omitted in tests). */
  memory?: MemoryService;
}

export interface AiStatus {
  enabled: boolean;
  provider: string;
  /** Enabled AND the selected provider is configured/reachable. */
  ok: boolean;
}

export interface AiService {
  ask(prompt: string): Promise<AiAnswer>;
  /** Streamed counterpart of {@link ask} (production phase 4): forwards prose
   *  chunks through `onDelta` and resolves with the finalized answer. When AI is
   *  off or the provider is unconfigured it resolves the nudge answer with **no**
   *  deltas (the IPC layer still pushes it as the stream's `done`). */
  askStream(
    prompt: string,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<AiAnswer>;
  draftWorkflow(description: string): Promise<WorkflowDraft>;
  /** Summarize + rank a routine's notifications (Phase 5). When AI is disabled it
   *  falls back to the deterministic local ranker so the digest still works. */
  summarizeDigest(
    items: DigestSourceItem[],
    opts: DigestSummarizeOptions,
  ): Promise<DigestRanking[]>;
  status(): AiStatus;
}

/** How many memories to fold into a prompt's context block (token-capped by being
 *  a handful of one-line facts, not raw history). */
const MEMORY_RECALL_LIMIT = 5;

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

export function createAiService({ providers, getConfig, memory }: AiServiceDeps): AiService {
  /** Prepend a compact "Relevant memory" block recalled for this prompt (capped),
   *  or return the prompt unchanged when memory is off / has no hits. */
  async function withMemory(prompt: string): Promise<string> {
    if (!memory?.enabled()) return prompt;
    const hits = await memory.recall(prompt, MEMORY_RECALL_LIMIT);
    if (hits.length === 0) return prompt;
    const block = hits.map((h) => `- ${h.text}`).join('\n');
    return (
      `Relevant memory from earlier sessions (use only if it helps; ignore otherwise):\n` +
      `${block}\n\n${prompt}`
    );
  }

  /** Remember the salient exchange after a successful answer — fire-and-forget so
   *  it never delays the response; gated + extracted by the memory engine. */
  function rememberExchange(prompt: string, answer: AiAnswer): void {
    if (!memory?.enabled() || answer.text.trim() === '') return;
    void memory.remember(`Q: ${prompt}\nA: ${answer.text}`, 'ask').catch(() => {
      /* memory write is best-effort; a failure must never surface to the asker. */
    });
  }

  return {
    async ask(prompt) {
      const ai = getConfig().ai;
      if (!ai.enabled) return disabledAnswer();
      const provider = providers[ai.provider];
      // Real provider selected but not configured (no key/model) → nudge, don't
      // fabricate. The `mock` default stays ready, so a fresh install still renders.
      if (!provider.ready({ settings: ai })) return unconfiguredAnswer(ai.provider);
      const answer = await provider.ask(await withMemory(prompt), { settings: ai });
      rememberExchange(prompt, answer);
      return answer;
    },

    async askStream(prompt, onDelta, signal) {
      const ai = getConfig().ai;
      // Mirror `ask`'s short-circuits — but as a completed answer with no deltas,
      // so the IPC layer just pushes a single `done` (the surface shows the nudge).
      if (!ai.enabled) return disabledAnswer();
      const provider = providers[ai.provider];
      if (!provider.ready({ settings: ai })) return unconfiguredAnswer(ai.provider);
      const answer = await provider.askStream(
        await withMemory(prompt),
        { settings: ai },
        onDelta,
        signal,
      );
      rememberExchange(prompt, answer);
      return answer;
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
