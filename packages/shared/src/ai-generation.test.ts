import { describe, it, expect } from 'vitest';
import {
  AiWorkflowPlanSchema,
  coerceDigestRankings,
  coerceMemoryFacts,
  planToWorkflowDraft,
  type AiWorkflowPlan,
} from './ai-generation.js';
import { WorkflowDraftSchema } from './schemas.js';
import { rankDigestItems } from './routines.js';
import type { DigestSourceItem, DigestSummarizeOptions } from './types.js';

const OPTS: DigestSummarizeOptions = { rankBy: 'importance', modelTier: 'mini', maxItems: 8 };

function items(): DigestSourceItem[] {
  return [
    { id: 'a', who: 'Priya', source: 'slack', text: 'needs the rollback plan now', ageMinutes: 2 },
    { id: 'b', who: 'CI', source: 'github', text: 'nightly build passed', ageMinutes: 30 },
  ];
}

describe('planToWorkflowDraft', () => {
  it('maps each kind to a valid action and produces a schema-valid draft', () => {
    const plan: AiWorkflowPlan = {
      name: 'Morning',
      keyword: 'morning',
      steps: [
        {
          title: 'Open Linear',
          kind: 'open-url',
          target: 'https://linear.app',
          subtitle: 'Linear',
        },
        { title: 'Open Slack', kind: 'open-app', target: 'Slack' },
        { title: 'Start timer', kind: 'run-command', target: 'timer start --minutes 50' },
        { title: 'Standup note', kind: 'snippet', target: '# Standup\n\n- ' },
      ],
    };
    const draft = planToWorkflowDraft(plan);
    expect(WorkflowDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft.steps[0]?.action).toMatchObject({ type: 'open-url', url: 'https://linear.app' });
    expect(draft.steps[0]?.target).toBe('Linear'); // subtitle wins for the review row
    expect(draft.steps[1]?.action).toMatchObject({ type: 'open-app', target: 'Slack' });
    expect(draft.steps[2]?.action).toMatchObject({
      type: 'run-command',
      command: 'timer',
      args: ['start', '--minutes', '50'],
    });
    expect(draft.steps[3]?.action).toMatchObject({ type: 'snippet' });
    // Action ids are unique + slugged from the titles.
    const ids = draft.steps.map((s) => s.action?.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('degrades a non-URL open-url target to a snippet (so it always validates)', () => {
    const plan: AiWorkflowPlan = {
      name: 'X',
      keyword: 'x',
      steps: [{ title: 'Note', kind: 'open-url', target: 'this is not a url' }],
    };
    const draft = planToWorkflowDraft(plan);
    expect(draft.steps[0]?.action).toMatchObject({ type: 'snippet', content: 'this is not a url' });
    expect(WorkflowDraftSchema.safeParse(draft).success).toBe(true);
  });

  it('rejects an empty plan via the schema', () => {
    expect(AiWorkflowPlanSchema.safeParse({ name: 'x', keyword: 'x', steps: [] }).success).toBe(
      false,
    );
  });
});

describe('coerceDigestRankings', () => {
  it('overlays the model summary/bucket/score where ids match, clamping the score', () => {
    const ranked = coerceDigestRankings(
      { items: [{ id: 'a', summary: 'Rollback plan', bucket: 'now', score: 1.4 }] },
      items(),
      OPTS,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toEqual({ id: 'a', summary: 'Rollback plan', bucket: 'now', score: 1 });
    // 'b' was missing from the model output → filled from the deterministic ranker.
    expect(ranked[1]).toEqual(rankDigestItems(items(), OPTS)[1]);
  });

  it('returns exactly one ranking per input item even if the model invents ids', () => {
    const ranked = coerceDigestRankings(
      { items: [{ id: 'ghost', summary: 'nope', bucket: 'now', score: 0.5 }] },
      items(),
      OPTS,
    );
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b']);
    expect(ranked).toEqual(rankDigestItems(items(), OPTS));
  });

  it('keeps the local summary when the model returns a blank one', () => {
    const ranked = coerceDigestRankings(
      { items: [{ id: 'a', summary: '   ', bucket: 'wait', score: 0.3 }] },
      items(),
      OPTS,
    );
    expect(ranked[0]?.summary).toBe('needs the rollback plan now');
    expect(ranked[0]?.bucket).toBe('wait');
  });
});

describe('coerceMemoryFacts (local memory engine)', () => {
  it('validates, trims, and clamps importance into [0,1]', () => {
    const facts = coerceMemoryFacts({
      facts: [
        { text: '  Ships on Thursday  ', kind: 'event', importance: 5 },
        { text: 'Prefers dark mode', kind: 'preference', importance: -2 },
      ],
    });
    expect(facts).toEqual([
      { text: 'Ships on Thursday', kind: 'event', importance: 1 },
      { text: 'Prefers dark mode', kind: 'preference', importance: 0 },
    ]);
  });

  it('coerces an unknown kind to "note" and a missing importance to 0.5', () => {
    const facts = coerceMemoryFacts({ facts: [{ text: 'A fact', kind: 'bogus' }] });
    expect(facts).toEqual([{ text: 'A fact', kind: 'note', importance: 0.5 }]);
  });

  it('drops empty text and de-duplicates by normalized text', () => {
    const facts = coerceMemoryFacts({
      facts: [
        { text: 'Same fact', kind: 'fact', importance: 0.5 },
        { text: 'same FACT', kind: 'fact', importance: 0.9 },
        { text: '   ', kind: 'note', importance: 0.5 },
      ],
    });
    expect(facts).toHaveLength(1);
    expect(facts[0]?.text).toBe('Same fact');
  });

  it('returns [] for unparseable model output', () => {
    expect(coerceMemoryFacts({ nope: true })).toEqual([]);
    expect(coerceMemoryFacts(null)).toEqual([]);
    expect(coerceMemoryFacts('garbage')).toEqual([]);
  });
});
