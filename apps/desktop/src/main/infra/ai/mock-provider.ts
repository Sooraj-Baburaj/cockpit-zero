import type { AiAnswer, AiSuggestedAction, WorkflowDraft } from '@cockpitzero/shared';
import type { AiProvider } from '../../services/ai/provider.js';

/**
 * The offline, deterministic AI provider — the test + dev default. It never
 * touches the network: output is a pure function of the prompt so unit tests can
 * assert against it, while the canned copy stays plausible (it reuses the
 * `ai-ask` mockup's sample answer + suggested actions). The real network
 * provider lives behind the `anthropic-provider` seam.
 */

/** Sample suggestions mirroring the `ai-ask` mockup (stable across calls). */
const SUGGESTIONS: readonly AiSuggestedAction[] = [
  {
    id: 'mock-draft-reply',
    title: 'Draft reply to Priya',
    subtitle: 'Rollback plan attached — flipping the flag now, QA can start at 2pm.',
    badge: 'Draft',
    // An inline action so surfaces can materialize/run the draft (the suggestion
    // → action seam Phase 2 uses); here a snippet copies the reply to clipboard.
    action: {
      id: 'mock-draft-reply',
      title: 'Draft reply to Priya',
      type: 'snippet',
      content: 'Rollback plan attached — flipping the flag now, QA can start at 2pm.',
    },
  },
  {
    id: 'mock-open-helix',
    title: 'Open #helix-launch',
    subtitle: 'Slack · 3 unread mentions',
    badge: 'App',
  },
  {
    id: 'mock-add-task',
    title: 'Add “CDN sign-off” to Today',
    subtitle: 'Linear · due before EOD',
    badge: 'Task',
  },
];

/** Builds the offline provider. No state — safe to construct once and reuse. */
export function createMockProvider(): AiProvider {
  return {
    id: 'mock',
    ready: () => true,
    async ask(prompt) {
      const trimmed = prompt.trim();
      return {
        text:
          `**Mock answer** for “${trimmed}”. Launch slipped to **Thursday** — staging is ` +
          'green, but the CDN cutover still needs sign-off from infra. Priya asked for the ' +
          '**rollback plan** before end of day.',
        meta: `cockpit-ai · mock · ${SUGGESTIONS.length} suggested actions`,
        // Copy so callers (and IPC serialization) never share the frozen sample.
        suggestions: SUGGESTIONS.map((s) => ({ ...s })),
      } satisfies AiAnswer;
    },
    async draftWorkflow(description) {
      const trimmed = description.trim();
      return {
        name: trimmed ? `Draft: ${trimmed}` : 'Untitled workflow',
        steps: SUGGESTIONS.slice(0, 2).map((s) => ({ ...s })),
      } satisfies WorkflowDraft;
    },
  };
}
