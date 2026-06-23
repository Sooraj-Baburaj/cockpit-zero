import { generateObject, generateText, streamText, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { createMistral } from '@ai-sdk/mistral';
import { createGroq } from '@ai-sdk/groq';
import { createCohere } from '@ai-sdk/cohere';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  AiDigestSummarySchema,
  AiWorkflowPlanSchema,
  coerceDigestRankings,
  planToWorkflowDraft,
  providerInfo,
  providerLabel,
  rankDigestItems,
} from '@cockpitzero/shared';
import type {
  AiAnswer,
  AiProviderId,
  AiSettings,
  DigestRanking,
  DigestSourceItem,
  DigestSummarizeOptions,
  WorkflowDraft,
} from '@cockpitzero/shared';
import type { AiContext, AiProvider } from '../../services/ai/provider.js';

/**
 * The universal BYOP provider (production phase 3) — one `AiProvider` over **every**
 * Vercel AI SDK provider (Claude, OpenAI, Gemini, Grok, Mistral, Groq, Cohere,
 * DeepSeek, and any OpenAI-compatible endpoint). It replaces the offline-only seam:
 * the provider is chosen from `ctx.settings.provider`, the model from
 * `ctx.settings.model`, and the API key is read from the OS-keychain-backed secrets
 * vault via the injected `getKey` — **never** from `config.json` or the renderer
 * (CLAUDE.md). Runs in the main process only; `ai` + `@ai-sdk/*` are dual CJS/ESM, so
 * electron-vite externalizes them from the CJS main build with no native rebuild.
 *
 * Dependency-inverted like the rest of the main process: `getKey` and the AI-SDK
 * entry points are injected, so `sdk-provider.test.ts` runs with fakes — no network,
 * no electron. `generateObject` output is mapped through the pure `shared` mappers
 * (`planToWorkflowDraft` / `coerceDigestRankings`) and re-validated, never trusted raw.
 */

const ASK_SYSTEM =
  'You are CockpitZero, a fast, keyboard-first desktop assistant. Answer the user ' +
  'concisely and concretely. Prefer short paragraphs and tight bullet points; lead ' +
  'with the answer. You may use light markdown (bold, bullets). Do not invent facts.';

const DRAFT_SYSTEM =
  'You design small automation workflows for a desktop launcher. Given a request, ' +
  'return an ordered list of 1–8 steps. Each step has a short title, a kind ' +
  '(open-url | open-app | run-command | snippet), and a target: a full URL for ' +
  'open-url, an application name for open-app, a shell command line for run-command, ' +
  'or the literal text for snippet. Keep it realistic and minimal.';

const DIGEST_SYSTEM =
  'You triage a set of notifications into a morning digest. For each input item return ' +
  'its exact id, a one-line summary, a bucket (now = needs action soon, wait = later, ' +
  'noise = ignorable), and an importance score in [0,1]. Echo every id back exactly once.';

/** Token usage shape we read defensively (AI SDK v5+: input/output/totalTokens). */
type Usage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

/** The injectable seams — real AI-SDK entry points + vault read by default. */
export interface SdkProviderDeps {
  /** Reads a provider's API key from the secrets vault (in-process only; never IPC). */
  getKey: (provider: AiProviderId) => string | null;
  /** Builds the AI-SDK language model for the current settings. Injectable so tests
   *  assert provider→model mapping + key wiring without constructing real clients. */
  createModel?: (settings: AiSettings, key: string | null) => LanguageModel;
  generateText?: typeof generateText;
  generateObject?: typeof generateObject;
  streamText?: typeof streamText;
}

/** Maps `config.ai.{provider,model,baseUrl}` + the vault key → an AI-SDK model. */
function defaultCreateModel(settings: AiSettings, key: string | null): LanguageModel {
  const apiKey = key ?? undefined;
  const model = settings.model;
  switch (settings.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(model);
    case 'openai':
      return createOpenAI({ apiKey })(model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model);
    case 'xai':
      return createXai({ apiKey })(model);
    case 'mistral':
      return createMistral({ apiKey })(model);
    case 'groq':
      return createGroq({ apiKey })(model);
    case 'cohere':
      return createCohere({ apiKey })(model);
    case 'deepseek':
      return createDeepSeek({ apiKey })(model);
    case 'openai-compatible':
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: settings.baseUrl ?? '',
        apiKey,
      })(model);
    default:
      // mock / managed never reach this provider (the service routes them elsewhere).
      throw new Error(`The SDK provider can't serve '${settings.provider}'.`);
  }
}

/** Provenance line: `cockpit-ai · Claude (Anthropic) · claude-opus-4-8 · 1.2s · 412 tok`. */
function buildMeta(settings: AiSettings, startedAt: number, usage?: Usage): string {
  const latency = ((Date.now() - startedAt) / 1000).toFixed(1);
  const parts = ['cockpit-ai', providerLabel(settings.provider), settings.model, `${latency}s`];
  const total = usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
  if (total > 0) parts.push(`${total} tok`);
  return parts.join(' · ');
}

/** Compact one-line-per-item prompt body for the digest summarize/rank step. */
function digestPrompt(items: DigestSourceItem[], opts: DigestSummarizeOptions): string {
  const lines = items
    .map((it) => `- id=${it.id} | ${it.who} via ${it.source} | ${it.ageMinutes}m ago | ${it.text}`)
    .join('\n');
  return (
    `Rank primarily by ${opts.rankBy}. Surface at most ${opts.maxItems} items as now/wait; ` +
    `the rest are noise.\n\n${lines}`
  );
}

/**
 * Build the universal SDK provider. `getKey` is the only required dep in production;
 * the rest default to the real AI SDK and are overridden in tests.
 */
export function createSdkProvider(deps: SdkProviderDeps): AiProvider {
  const { getKey } = deps;
  const createModel = deps.createModel ?? defaultCreateModel;
  const doGenerateText = deps.generateText ?? generateText;
  const doGenerateObject = deps.generateObject ?? generateObject;
  const doStreamText = deps.streamText ?? streamText;

  const modelFor = (settings: AiSettings) => createModel(settings, getKey(settings.provider));

  return {
    id: 'sdk',

    ready(ctx: AiContext): boolean {
      const s = ctx.settings;
      if (s.model.trim() === '') return false;
      const info = providerInfo(s.provider);
      if (info?.requiresBaseUrl && !s.baseUrl?.trim()) return false;
      // openai-compatible (e.g. a local Ollama) needs no key; every hosted provider does.
      if (info && !info.requiresKey) return true;
      return getKey(s.provider) !== null;
    },

    async ask(prompt, ctx): Promise<AiAnswer> {
      const startedAt = Date.now();
      const { text, usage } = await doGenerateText({
        model: modelFor(ctx.settings),
        system: ASK_SYSTEM,
        prompt,
      });
      return {
        text: text.trim(),
        meta: buildMeta(ctx.settings, startedAt, usage),
        // Action suggestions come from the agent/tool loop (phase 6) — none here yet.
        suggestions: [],
      };
    },

    async askStream(prompt, ctx, onDelta, signal): Promise<AiAnswer> {
      const startedAt = Date.now();
      const result = doStreamText({
        model: modelFor(ctx.settings),
        system: ASK_SYSTEM,
        prompt,
        // The SDK aborts the underlying request when this fires (cancelAiStream).
        abortSignal: signal,
      });
      // Emit each token chunk as it lands; the main process coalesces before IPC.
      for await (const delta of result.textStream) onDelta(delta);
      // The aggregated text + usage are settled once the stream finishes.
      const [text, usage] = await Promise.all([result.text, result.usage]);
      return {
        text: text.trim(),
        meta: buildMeta(ctx.settings, startedAt, usage),
        // Suggestions are easiest to attach at the end; the prose streams, the
        // (currently empty) suggestions come with `done` (phase-4 note).
        suggestions: [],
      };
    },

    async draftWorkflow(description, ctx): Promise<WorkflowDraft> {
      const { object } = await doGenerateObject({
        model: modelFor(ctx.settings),
        schema: AiWorkflowPlanSchema,
        system: DRAFT_SYSTEM,
        prompt: `Draft a workflow for this request:\n\n${description}`,
      });
      // Map the flat model plan → a validated WorkflowDraft (the service re-validates too).
      return planToWorkflowDraft(object);
    },

    async summarizeDigest(items, opts, ctx): Promise<DigestRanking[]> {
      try {
        const { object } = await doGenerateObject({
          model: modelFor(ctx.settings),
          schema: AiDigestSummarySchema,
          system: DIGEST_SYSTEM,
          prompt: digestPrompt(items, opts),
        });
        return coerceDigestRankings(object, items, opts);
      } catch {
        // Structured-output support varies by provider (e.g. Cohere) — never fail a
        // digest; fall back to the deterministic local ranker (CLAUDE.md: local-first).
        return rankDigestItems(items, opts);
      }
    },
  };
}
