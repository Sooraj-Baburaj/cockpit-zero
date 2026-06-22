import { describe, it, expect } from 'vitest';
import { WorkflowDraftSchema } from './schemas.js';
import { draftToConfig } from './workflow-draft.js';
import type { WorkflowDraft } from './types.js';

/** A minimal, schema-valid draft: one new action + one existing-action step. */
function sampleDraft(): WorkflowDraft {
  return {
    name: 'Morning routine',
    keyword: 'morning',
    steps: [
      {
        actionId: null,
        title: 'Open dashboard',
        target: 'datadoghq.com',
        kindLabel: 'URL',
        action: {
          id: 'draft-1',
          title: 'Open dashboard',
          type: 'open-url',
          url: 'https://datadoghq.com',
        },
      },
      { actionId: 'act_existing', title: 'Existing step', kindLabel: 'App' },
    ],
  };
}

describe('WorkflowDraftSchema', () => {
  it('accepts a well-formed draft', () => {
    expect(WorkflowDraftSchema.safeParse(sampleDraft()).success).toBe(true);
  });

  it('rejects a draft with no steps', () => {
    const draft = { ...sampleDraft(), steps: [] };
    expect(WorkflowDraftSchema.safeParse(draft).success).toBe(false);
  });

  it('rejects a step that neither references nor carries an action', () => {
    const draft: unknown = {
      name: 'x',
      keyword: '',
      steps: [{ actionId: null, title: 'Dangling', kindLabel: 'URL' }],
    };
    expect(WorkflowDraftSchema.safeParse(draft).success).toBe(false);
  });

  it('rejects a step whose carried action is malformed', () => {
    const draft: unknown = {
      name: 'x',
      keyword: '',
      steps: [
        {
          actionId: null,
          title: 'Bad URL',
          kindLabel: 'URL',
          action: { id: 'a', title: 'Bad', type: 'open-url', url: 'not a url' },
        },
      ],
    };
    expect(WorkflowDraftSchema.safeParse(draft).success).toBe(false);
  });
});

describe('draftToConfig', () => {
  it('mints fresh actions for proposed steps and references them in order', () => {
    const { actions, workflow } = draftToConfig(sampleDraft());

    // One new action created (the other step reuses an existing id).
    expect(actions).toHaveLength(1);
    expect(actions[0]!.title).toBe('Open dashboard');
    // The fresh id replaces the draft's placeholder id.
    expect(actions[0]!.id).not.toBe('draft-1');

    expect(workflow.name).toBe('Morning routine');
    expect(workflow.steps).toEqual([actions[0]!.id, 'act_existing']);
  });

  it('gives the workflow and each new action distinct ids', () => {
    const { actions, workflow } = draftToConfig(sampleDraft());
    expect(workflow.id).not.toBe(actions[0]!.id);
    expect(workflow.id).toMatch(/^wf_/);
    expect(actions[0]!.id).toMatch(/^act_/);
  });

  it('produces a config-valid workflow (≥1 step)', () => {
    const { workflow } = draftToConfig(sampleDraft());
    expect(workflow.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('does not mutate the input draft', () => {
    const draft = sampleDraft();
    const snapshot = JSON.parse(JSON.stringify(draft));
    draftToConfig(draft);
    expect(draft).toEqual(snapshot);
  });
});
