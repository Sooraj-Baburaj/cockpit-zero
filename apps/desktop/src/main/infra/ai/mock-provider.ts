import type { AiAnswer, AiSuggestedAction, WorkflowDraft } from '@cockpitzero/shared';
import type { AiProvider } from '../../services/ai/provider.js';

/**
 * The canned "Morning routine" draft (the `ai-workflow.html` sample). Each step
 * carries a single, valid action so it materializes cleanly; `kindLabel` is the
 * AI's human summary (e.g. "URL ×3") and may read differently from the action's
 * concrete kind. Two steps stand in for Phase-7 tool calls (open three
 * dashboards via `open`; post to Slack by opening the app) until the tool layer
 * lands. `{date}` follows the L2 `{token}` syntax; workflow execution stays L3
 * (no per-step argument capture yet), so it's a literal placeholder for now.
 */
const MORNING_ROUTINE: WorkflowDraft = {
  name: 'Morning routine',
  keyword: 'morning',
  steps: [
    {
      actionId: null,
      title: 'Open dashboards',
      target: 'Datadog · Linear · Stripe',
      kindLabel: 'URL ×3',
      action: {
        id: 'draft-dashboards',
        title: 'Open dashboards',
        type: 'run-command',
        command: 'open',
        args: ['https://app.datadoghq.com', 'https://linear.app', 'https://dashboard.stripe.com'],
      },
    },
    {
      actionId: null,
      title: 'Start focus timer',
      target: 'timer start --minutes 50',
      kindLabel: 'Command',
      action: {
        id: 'draft-timer',
        title: 'Start focus timer',
        type: 'run-command',
        command: 'timer',
        args: ['start', '--minutes', '50'],
      },
    },
    {
      actionId: null,
      title: 'Create doc “Standup — {date}”',
      target: '~/Docs/standup/{date}.md',
      kindLabel: 'Snippet',
      action: {
        id: 'draft-standup',
        title: 'Create doc “Standup — {date}”',
        type: 'snippet',
        content: '# Standup — {date}\n\n- ',
      },
    },
    {
      actionId: null,
      title: 'Post “Starting standup” to #team',
      target: 'Slack · #team-apollo',
      kindLabel: 'App',
      action: {
        id: 'draft-slack',
        title: 'Post “Starting standup” to #team',
        type: 'open-app',
        target: 'Slack',
      },
    },
  ],
};

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
    async draftWorkflow() {
      // Deterministic + offline: the description is ignored and we return the
      // canned sample so the drafting flow is testable without the network. Deep-
      // copy so callers (and IPC serialization) never share the frozen sample.
      return {
        ...MORNING_ROUTINE,
        steps: MORNING_ROUTINE.steps.map((step) => ({
          ...step,
          action: step.action ? { ...step.action } : undefined,
        })),
      } satisfies WorkflowDraft;
    },
  };
}
