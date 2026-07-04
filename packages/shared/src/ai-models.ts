import { AiProviderIdSchema } from './schemas.js';
import type { AiProviderId } from './types.js';

/**
 * The BYOP provider + model catalog (production phase 3). Pure data the Console
 * reads to populate the provider picker, the model dropdown, and the
 * openai-compatible base-URL presets — no `electron`, no network, so it's shared
 * by the renderer (the picker) and assertable in plain Node.
 *
 * Model ids are a **curated short list per provider plus a free-text override**:
 * new models work without shipping a release (the Console always offers "Custom…"),
 * and the on-disk `ai.model` is just a string. For Claude ids we follow the
 * `claude-api` skill (never hard-coded from memory). The universal adapter that
 * actually calls these lives in the desktop main process (`infra/ai/sdk-provider.ts`).
 */

/** One selectable model in a provider's dropdown. */
export interface ModelOption {
  id: string;
  label: string;
}

/** Display + capability metadata for one BYOP provider. */
export interface ProviderInfo {
  id: AiProviderId;
  /** Picker label, e.g. "Claude (Anthropic)". */
  label: string;
  /** One-line description shown under the picker. */
  blurb: string;
  /** Whether an API key is required to connect. `openai-compatible` is false
   *  (a local Ollama endpoint needs no key); every hosted provider is true. */
  requiresKey: boolean;
  /** Whether the provider needs a custom base URL (only `openai-compatible`). */
  requiresBaseUrl: boolean;
  /** Where to mint a key — shown as a help affordance next to the key field. */
  keyUrl?: string;
}

/**
 * The BYOP providers offered in the Console picker, in display order. `mock` (the
 * offline default) and `managed` (phase 9, server-routed) are deliberately not
 * here — they're not something a BYOP user pastes a key for.
 */
export const PROVIDER_CATALOG: readonly ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    blurb: 'Claude Opus, Sonnet & Haiku via your Anthropic API key.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    blurb: 'GPT-5 / GPT-4.1 / o-series via your OpenAI API key.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'google',
    label: 'Gemini (Google)',
    blurb: 'Gemini 2.5 Pro & Flash via a Google AI Studio key.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'xai',
    label: 'Grok (xAI)',
    blurb: 'Grok 4 / 3 via your xAI API key.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://console.x.ai',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    blurb: 'Mistral Large / Small via your Mistral API key.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    blurb: 'Llama & friends at very low latency on Groq.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    blurb: 'DeepSeek Chat & Reasoner via your DeepSeek API key.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    blurb: 'Cohere Command models via your Cohere API key.',
    requiresKey: true,
    requiresBaseUrl: false,
    keyUrl: 'https://dashboard.cohere.com/api-keys',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible',
    blurb: 'OpenRouter, Ollama, Together, Fireworks, or any custom endpoint.',
    requiresKey: false,
    requiresBaseUrl: true,
  },
];

/**
 * Curated model ids per provider (the dropdown), total over every `AiProviderId`
 * so the picker is exhaustive. `openai-compatible` / `managed` / `mock` are empty
 * (free-text only / not BYOP-picked). Always paired with a "Custom…" entry in the
 * UI — these are a convenience, not a gate, so a new model never needs a release.
 */
export const MODEL_CATALOG: Record<AiProviderId, readonly ModelOption[]> = {
  anthropic: [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — most capable' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest' },
  ],
  openai: [
    { id: 'gpt-5', label: 'GPT-5 — most capable' },
    { id: 'gpt-5-mini', label: 'GPT-5 mini — fast & cheap' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'o4-mini', label: 'o4-mini — reasoning' },
  ],
  google: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — most capable' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — fast' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  xai: [
    { id: 'grok-4', label: 'Grok 4 — most capable' },
    { id: 'grok-3', label: 'Grok 3' },
    { id: 'grok-3-mini', label: 'Grok 3 mini — fast' },
  ],
  mistral: [
    { id: 'mistral-large-latest', label: 'Mistral Large' },
    { id: 'mistral-small-latest', label: 'Mistral Small' },
    { id: 'pixtral-large-latest', label: 'Pixtral Large — vision' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — versatile' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B — instant' },
  ],
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  ],
  cohere: [
    { id: 'command-a-03-2025', label: 'Command A' },
    { id: 'command-r-plus', label: 'Command R+' },
    { id: 'command-r', label: 'Command R' },
  ],
  'openai-compatible': [],
  managed: [],
  mock: [],
};

/** One quick-fill preset for the `openai-compatible` provider — sets the base URL
 *  (and suggests model ids) for a popular OpenAI-shaped endpoint. */
export interface OpenAiCompatiblePreset {
  id: string;
  label: string;
  /** The OpenAI-shaped base URL, e.g. `https://openrouter.ai/api/v1`. Empty for "Custom". */
  baseUrl: string;
  /** Whether the endpoint needs an API key (Ollama running locally does not). */
  requiresKey: boolean;
  /** A couple of suggested model ids, surfaced as a starting point (still free-text). */
  models?: readonly ModelOption[];
}

/** Quick-fill base-URL presets for `openai-compatible` (OpenRouter / Ollama / …). */
export const OPENAI_COMPATIBLE_PRESETS: readonly OpenAiCompatiblePreset[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    models: [
      { id: 'anthropic/claude-opus-4.8', label: 'anthropic/claude-opus-4.8' },
      { id: 'openai/gpt-5', label: 'openai/gpt-5' },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    requiresKey: false,
    models: [
      { id: 'llama3.2', label: 'llama3.2' },
      { id: 'qwen2.5', label: 'qwen2.5' },
    ],
  },
  {
    id: 'together',
    label: 'Together.ai',
    baseUrl: 'https://api.together.xyz/v1',
    requiresKey: true,
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    requiresKey: true,
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    requiresKey: true,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    requiresKey: true,
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    requiresKey: true,
  },
  { id: 'custom', label: 'Custom…', baseUrl: '', requiresKey: true },
];

/** Look up a provider's catalog entry (BYOP providers only; undefined for mock/managed). */
export function providerInfo(provider: AiProviderId): ProviderInfo | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === provider);
}

/** Human label for any provider id. `managed` (P9, not in the BYOP catalog) gets
 *  its product name; anything else non-catalog falls back to the raw id. */
export function providerLabel(provider: AiProviderId): string {
  if (provider === 'managed') return 'CockpitZero AI';
  return providerInfo(provider)?.label ?? provider;
}

/** The default (first curated) model id for a provider, or '' when there's no
 *  catalog (openai-compatible / managed / mock). Used to seed `ai.model` when the
 *  user switches provider so the picker is never left empty. */
export function defaultModelFor(provider: AiProviderId): string {
  return MODEL_CATALOG[provider][0]?.id ?? '';
}

/** Every valid provider id (mirrors the schema enum — never hand-order a parallel list). */
export const AI_PROVIDER_IDS: readonly AiProviderId[] = AiProviderIdSchema.options;
