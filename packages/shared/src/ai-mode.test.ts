import { describe, it, expect } from 'vitest';
import {
  IDLE_AI_PHASE,
  aiPhaseReducer,
  canOfferAi,
  computeLauncherView,
  type AiPhase,
} from './ai-mode.js';
import type { AiAnswer, AiSettings, ResolvedQuery } from './types.js';

const AI_ON: AiSettings = {
  enabled: true,
  provider: 'mock',
  modelTier: 'pro',
  askFromBar: true,
  memoryEnabled: true,
  tools: ['files'],
};

const ANSWER: AiAnswer = { text: 'hi', meta: 'mock', suggestions: [] };

const EMPTY_RESULTS: ResolvedQuery = { kind: 'results', results: [] };

describe('aiPhaseReducer', () => {
  it('ask → pending (with empty streamed text)', () => {
    expect(aiPhaseReducer(IDLE_AI_PHASE, { type: 'ask', query: 'q' })).toEqual({
      status: 'pending',
      query: 'q',
      text: '',
    });
  });

  it('delta accumulates streamed text while pending the same query', () => {
    const pending: AiPhase = { status: 'pending', query: 'q', text: 'Hello' };
    expect(aiPhaseReducer(pending, { type: 'delta', query: 'q', text: ' world' })).toEqual({
      status: 'pending',
      query: 'q',
      text: 'Hello world',
    });
  });

  it('ignores a delta for a query we are no longer asking', () => {
    const pending: AiPhase = { status: 'pending', query: 'new', text: '' };
    expect(aiPhaseReducer(pending, { type: 'delta', query: 'old', text: 'x' })).toBe(pending);
  });

  it('ignores a delta once answered', () => {
    const answer: AiPhase = { status: 'answer', query: 'q', answer: ANSWER };
    expect(aiPhaseReducer(answer, { type: 'delta', query: 'q', text: 'x' })).toBe(answer);
  });

  it('resolved (done) while pending the same query → answer', () => {
    const pending: AiPhase = { status: 'pending', query: 'q', text: 'partial' };
    expect(aiPhaseReducer(pending, { type: 'resolved', query: 'q', answer: ANSWER })).toEqual({
      status: 'answer',
      query: 'q',
      answer: ANSWER,
    });
  });

  it('ignores a stale answer for a query we are no longer asking', () => {
    const pending: AiPhase = { status: 'pending', query: 'new', text: '' };
    // An older in-flight ask for "old" resolves late — must be dropped.
    expect(aiPhaseReducer(pending, { type: 'resolved', query: 'old', answer: ANSWER })).toBe(
      pending,
    );
  });

  it('error while pending surfaces a finalized error answer', () => {
    const pending: AiPhase = { status: 'pending', query: 'q', text: 'partial' };
    const next = aiPhaseReducer(pending, { type: 'error', query: 'q', message: 'boom' });
    expect(next.status).toBe('answer');
    if (next.status === 'answer') {
      expect(next.answer.text).toBe('boom');
      expect(next.answer.suggestions).toEqual([]);
    }
  });

  it('ignores an error for a query we are no longer asking', () => {
    const pending: AiPhase = { status: 'pending', query: 'new', text: '' };
    expect(aiPhaseReducer(pending, { type: 'error', query: 'old', message: 'boom' })).toBe(pending);
  });

  it('ignores resolved when idle', () => {
    expect(aiPhaseReducer(IDLE_AI_PHASE, { type: 'resolved', query: 'q', answer: ANSWER })).toBe(
      IDLE_AI_PHASE,
    );
  });

  it('reset → idle from any phase', () => {
    const answer: AiPhase = { status: 'answer', query: 'q', answer: ANSWER };
    expect(aiPhaseReducer(answer, { type: 'reset' })).toEqual(IDLE_AI_PHASE);
  });
});

describe('canOfferAi', () => {
  it('true only when enabled and askFromBar', () => {
    expect(canOfferAi(AI_ON)).toBe(true);
    expect(canOfferAi({ ...AI_ON, enabled: false })).toBe(false);
    expect(canOfferAi({ ...AI_ON, askFromBar: false })).toBe(false);
    expect(canOfferAi(null)).toBe(false);
    expect(canOfferAi(undefined)).toBe(false);
  });
});

describe('computeLauncherView', () => {
  const base = { settled: true, ai: AI_ON, phase: IDLE_AI_PHASE } as const;

  it('empty query → resting', () => {
    expect(computeLauncherView({ ...base, query: '', resolved: EMPTY_RESULTS })).toEqual({
      kind: 'resting',
    });
  });

  it('zero matches + AI on + settled → ai-offer (trimmed query)', () => {
    expect(computeLauncherView({ ...base, query: '  hello  ', resolved: EMPTY_RESULTS })).toEqual({
      kind: 'ai-offer',
      query: 'hello',
    });
  });

  it('zero matches but not yet settled → plain empty (no premature offer)', () => {
    expect(
      computeLauncherView({ ...base, settled: false, query: 'hello', resolved: EMPTY_RESULTS }),
    ).toEqual({ kind: 'empty' });
  });

  it('zero matches + AI off → plain empty', () => {
    expect(
      computeLauncherView({
        ...base,
        ai: { ...AI_ON, enabled: false },
        query: 'hello',
        resolved: EMPTY_RESULTS,
      }),
    ).toEqual({ kind: 'empty' });
  });

  it('zero matches + askFromBar off → plain empty', () => {
    expect(
      computeLauncherView({
        ...base,
        ai: { ...AI_ON, askFromBar: false },
        query: 'hello',
        resolved: EMPTY_RESULTS,
      }),
    ).toEqual({ kind: 'empty' });
  });

  it('non-empty results → results (AI never offered)', () => {
    const resolved: ResolvedQuery = {
      kind: 'results',
      results: [
        {
          kind: 'app',
          id: '/A.app',
          title: 'A',
          path: '/A.app',
          score: 1,
          matches: [],
        },
      ],
    };
    expect(computeLauncherView({ ...base, query: 'a', resolved })).toEqual({
      kind: 'results',
      results: resolved.results,
    });
  });

  it('argument capture passes through untouched', () => {
    const resolved: ResolvedQuery = {
      kind: 'argument',
      action: { id: 'x', title: 'X', type: 'open-url', url: 'https://e.com/{q}' },
      keyword: 'g',
      values: [''],
      activeIndex: 0,
    };
    expect(computeLauncherView({ ...base, query: 'g ', resolved })).toBe(resolved);
  });

  it('pending phase owns the body regardless of search (threading streamed text)', () => {
    expect(
      computeLauncherView({
        ...base,
        phase: { status: 'pending', query: 'q', text: 'so far' },
        query: 'q',
        resolved: EMPTY_RESULTS,
      }),
    ).toEqual({ kind: 'ai-pending', query: 'q', text: 'so far' });
  });

  it('answer phase renders the answer regardless of search', () => {
    expect(
      computeLauncherView({
        ...base,
        phase: { status: 'answer', query: 'q', answer: ANSWER },
        query: 'q',
        resolved: EMPTY_RESULTS,
      }),
    ).toEqual({ kind: 'ai-answer', query: 'q', answer: ANSWER });
  });

  it('drops a stale answer once the field no longer holds the asked query', () => {
    // Asked "q", now editing to "qx" → back to live search (here: the offer for "qx").
    expect(
      computeLauncherView({
        ...base,
        phase: { status: 'answer', query: 'q', answer: ANSWER },
        query: 'qx',
        resolved: EMPTY_RESULTS,
      }),
    ).toEqual({ kind: 'ai-offer', query: 'qx' });
  });
});
