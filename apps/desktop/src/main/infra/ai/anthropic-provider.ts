import type { AiProvider } from '../../services/ai/provider.js';

/**
 * SEAM ONLY — the real Claude (Anthropic) provider.
 *
 * This file deliberately does NOT call the network. It exists so the provider
 * registry typechecks and `aiStatus()` can report "not configured" until the
 * real implementation lands. `ask`/`draftWorkflow` throw until then.
 *
 * TODO(phase-real-ai): implement `ask`/`draftWorkflow` against the Claude
 * Messages API. Consult the `claude-api` skill for current model ids and request
 * shape — do not hard-code model ids from memory. Map `ctx.settings.modelTier`
 * (`mini` / `pro`) to concrete ids there. Read the API key from the OS keychain /
 * Electron `safeStorage`, NEVER from `config.json` (CLAUDE.md gotcha).
 */

/**
 * Placeholder key lookup. A real implementation reads from `safeStorage` / the OS
 * keychain; the env var is only a stand-in so `ready()` has something to gate on
 * without committing a key. Returns undefined when unconfigured.
 */
function apiKey(): string | undefined {
  return process.env.COCKPITZERO_ANTHROPIC_KEY || undefined;
}

const NOT_CONFIGURED =
  'The Anthropic AI provider is not configured yet. Switch the provider to ' +
  '“mock” in Settings, or add an API key once the real provider is wired.';

/** Builds the (currently inert) real-provider seam. */
export function createAnthropicProvider(): AiProvider {
  return {
    id: 'anthropic',
    ready: () => apiKey() !== undefined,
    async ask() {
      throw new Error(NOT_CONFIGURED);
    },
    async draftWorkflow() {
      throw new Error(NOT_CONFIGURED);
    },
  };
}
