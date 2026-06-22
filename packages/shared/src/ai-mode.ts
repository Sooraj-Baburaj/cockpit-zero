import type { AiAnswer, AiSettings, LauncherItem, ResolvedQuery } from './types.js';

/**
 * Pure launcher AI-mode state — no React, no `electron`, so it unit-tests in
 * plain Node. The renderer keeps the `AiPhase` in a reducer and derives what the
 * bar should render via `computeLauncherView`. Keeping the decision here (rather
 * than in the component) is what makes "when do we offer AI?" and "offer →
 * pending → answer" transitions assertable in isolation.
 */

/**
 * The assistant's interaction phase within the bar. Renderer-local (not persisted
 * config): `idle` while the user is searching, `pending` between Ask and the
 * answer arriving, `answer` once `askAI` resolves.
 */
export type AiPhase =
  | { status: 'idle' }
  | { status: 'pending'; query: string }
  | { status: 'answer'; query: string; answer: AiAnswer };

/** The resting phase — exported so the reducer's initial state has one source. */
export const IDLE_AI_PHASE: AiPhase = { status: 'idle' };

/**
 * Events that move the AI phase. `ask` is fired from the offer's Enter, `resolved`
 * when `askAI` returns, and `reset` whenever the user edits the query / steps back
 * to live search.
 */
export type AiPhaseEvent =
  | { type: 'ask'; query: string }
  | { type: 'resolved'; query: string; answer: AiAnswer }
  | { type: 'reset' };

/** Reducer for {@link AiPhase}. Pure: same (state, event) → same next state. */
export function aiPhaseReducer(state: AiPhase, event: AiPhaseEvent): AiPhase {
  switch (event.type) {
    case 'ask':
      return { status: 'pending', query: event.query };
    case 'resolved':
      // Drop a stale answer if the user moved on (edited the query, or asked a
      // new question) before this one resolved — the in-flight query no longer
      // matches what we're waiting on.
      if (state.status !== 'pending' || state.query !== event.query) return state;
      return { status: 'answer', query: event.query, answer: event.answer };
    case 'reset':
      return IDLE_AI_PHASE;
    default: {
      const _never: never = event;
      return _never;
    }
  }
}

/** Whether "Ask AI from the bar" is permitted at all (the config gate). */
export function canOfferAi(ai: AiSettings | null | undefined): boolean {
  return !!ai && ai.enabled && ai.askFromBar;
}

/**
 * What the launcher body should render — a superset of `ResolvedQuery` with the
 * AI-mode states layered on. Exactly one is active at a time; the screen renders
 * by switching on `kind`.
 */
export type LauncherView =
  /** Empty query: the bar shows nothing under the search field. */
  | { kind: 'resting' }
  /** Parameterized-action capture (L2) — stands alone, never mixes with AI. */
  | Extract<ResolvedQuery, { kind: 'argument' }>
  /** Ranked config + system results. */
  | { kind: 'results'; results: LauncherItem[] }
  /** Non-empty query, nothing matched, AI off (or unsettled): the plain empty state. */
  | { kind: 'empty' }
  /** Nothing matched + AI enabled: offer to ask. */
  | { kind: 'ai-offer'; query: string }
  /** `askAI` is in flight. */
  | { kind: 'ai-pending'; query: string }
  /** `askAI` resolved: prose answer + suggested actions. */
  | { kind: 'ai-answer'; query: string; answer: AiAnswer };

export interface LauncherViewInput {
  /** The raw (un-trimmed) query in the field. */
  query: string;
  /** Merged config + system search resolution for `query`. */
  resolved: ResolvedQuery;
  /** True once BOTH the config and system search phases have settled for `query` —
   *  gates the AI offer so it never flashes before the slow file index returns. */
  settled: boolean;
  /** Current AI config (null while config is still loading). */
  ai: AiSettings | null | undefined;
  /** The live AI phase (idle / pending / answer). */
  phase: AiPhase;
}

/**
 * Decide what the launcher renders. Order matters: an in-flight or completed ask
 * owns the body regardless of the underlying search, then argument capture, then
 * ranked results, and only a genuinely empty non-trivial query reaches the
 * AI-offer-vs-empty-state decision.
 */
export function computeLauncherView({
  query,
  resolved,
  settled,
  ai,
  phase,
}: LauncherViewInput): LauncherView {
  // An ask owns the body only while the field still holds the asked query — the
  // moment the user edits it, the (now stale) pending/answer falls away and the
  // bar returns to live search, with no flicker (the reducer resets shortly after).
  const trimmed = query.trim();
  if (phase.status === 'pending' && phase.query === trimmed) {
    return { kind: 'ai-pending', query: phase.query };
  }
  if (phase.status === 'answer' && phase.query === trimmed) {
    return { kind: 'ai-answer', query: phase.query, answer: phase.answer };
  }

  if (resolved.kind === 'argument') return resolved;
  if (resolved.results.length > 0) return { kind: 'results', results: resolved.results };

  if (query.trim() === '') return { kind: 'resting' };

  // No matches. Offer AI only once both searches have settled (so the offer never
  // flashes before the slow file index returns); otherwise the plain empty state.
  if (settled && canOfferAi(ai)) return { kind: 'ai-offer', query: query.trim() };
  return { kind: 'empty' };
}
