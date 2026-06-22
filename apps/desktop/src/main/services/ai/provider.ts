import type {
  AiAnswer,
  AiSettings,
  DigestRanking,
  DigestSourceItem,
  DigestSummarizeOptions,
  WorkflowDraft,
} from '@cockpitzero/shared';

/**
 * The AI provider port. Following the same dependency-inversion as the
 * action-runner and search providers: the service layer *defines* this port,
 * `infra/ai/*` adapters *implement* it (offline mock now, real Claude later),
 * and the `AiService` depends only on the injected providers — so the service
 * is unit-testable with fakes and contains no `electron` or network code.
 */

/** Per-call context handed to a provider (config-derived; never electron). */
export interface AiContext {
  /** The current `ai` config block (provider, tier, tool grants, …). */
  settings: AiSettings;
}

/** A pluggable AI engine. `mock` is the offline default; `anthropic` is a seam. */
export interface AiProvider {
  /** Provider key — matches `config.ai.provider` (`mock` / `anthropic`). */
  readonly id: string;
  /** Whether the provider is configured/reachable (drives `aiStatus().ok`).
   *  Synchronous so status reads can't hang on the network. */
  ready(ctx: AiContext): boolean;
  /** Answer a free-text prompt with prose + suggested actions. */
  ask(prompt: string, ctx: AiContext): Promise<AiAnswer>;
  /** Draft a workflow from a natural-language description (Phase 4). */
  draftWorkflow(description: string, ctx: AiContext): Promise<WorkflowDraft>;
  /** Summarize + bucket/rank a routine's notifications (Phase 5). Returns one
   *  ranking per input item; the digest runner assembles the surface from these. */
  summarizeDigest(
    items: DigestSourceItem[],
    opts: DigestSummarizeOptions,
    ctx: AiContext,
  ): Promise<DigestRanking[]>;
}
