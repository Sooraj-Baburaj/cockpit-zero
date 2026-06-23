import { rankDigestItems } from '@cockpitzero/shared';
import type { AiProvider } from '../../services/ai/provider.js';

/**
 * SEAM ONLY — the `managed` provider (production phase 9).
 *
 * Managed inference routes through **our backend proxy + complexity router** (our
 * keys, server-side model selection, usage metering) and requires a logged-in
 * account — not a BYOP key. That backend doesn't exist yet, so this is inert:
 * `ready()` is always false (the service then shows the "connect a provider / sign
 * in" state and never calls the methods below), and the methods throw if ever
 * reached. It exists so the `providers` record is total over `AiProviderId` and the
 * enum slot is reserved without a real implementation.
 *
 * TODO(phase-9): call the backend `/inference` endpoint with the session token from
 * the vault; the router picks the model by task complexity (no BYOP model id).
 */
const NOT_AVAILABLE =
  'Managed AI (CockpitZero-hosted) isn’t available yet. Use your own provider key in ' +
  'the Console, or sign in once managed inference ships.';

export function createManagedProvider(): AiProvider {
  return {
    id: 'managed',
    ready: () => false,
    async ask() {
      throw new Error(NOT_AVAILABLE);
    },
    async draftWorkflow() {
      throw new Error(NOT_AVAILABLE);
    },
    // Digests must always render, even with a not-yet-available provider selected —
    // fall back to the deterministic local ranker rather than throwing.
    async summarizeDigest(items, opts) {
      return rankDigestItems(items, opts);
    },
  };
}
