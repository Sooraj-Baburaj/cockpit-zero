import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  IDLE_AI_PHASE,
  aiPhaseReducer,
  type AiPhase,
  type AiStreamEvent,
} from '@cockpitzero/shared';
import { api } from '../lib/api.js';

/** A live stream subscription: its (eventually-known) `streamId` + the listener
 *  teardown. `id` is `null` until `askAIStream` resolves with it. */
interface StreamSub {
  id: string | null;
  unsubscribe: () => void;
}

export interface AiAsk {
  /** The current interaction phase (idle / pending+streamed text / answer). */
  phase: AiPhase;
  /** Start a streamed ask. A no-op for blank input; cancels any prior ask first. */
  ask: (prompt: string) => void;
  /** Abandon any in-flight ask and return to idle (e.g. the query was edited). */
  reset: () => void;
}

/**
 * Shared "ask the assistant, stream the answer back" hook (production phase 4),
 * used by both the launcher bar and the Console composer so the streaming +
 * cancellation plumbing lives in one place (reuse, don't fork). It drives the pure
 * {@link aiPhaseReducer} — delta accumulation + done/error finalization is asserted
 * in `shared` — and owns the push-channel subscription: one `onAiStream` listener
 * per ask, torn down (and the provider call aborted via `cancelAiStream`) whenever
 * the ask is abandoned or the component unmounts. Events are filtered by the
 * resolved `streamId`, so a late event from a just-cancelled ask can't leak into a
 * new one. The reducer's query guard is a second line of defence.
 */
export function useAiAsk(): AiAsk {
  const [phase, dispatch] = useReducer(aiPhaseReducer, IDLE_AI_PHASE);
  const subRef = useRef<StreamSub | null>(null);

  /** Tear down the active subscription and abort its provider call (idempotent). */
  const cancel = useCallback(() => {
    const sub = subRef.current;
    if (!sub) return;
    sub.unsubscribe();
    if (sub.id) void api.cancelAiStream(sub.id);
    subRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    dispatch({ type: 'reset' });
  }, [cancel]);

  const ask = useCallback(
    (prompt: string) => {
      const q = prompt.trim();
      if (q === '') return;
      cancel(); // abandon any prior in-flight ask before starting a new one
      dispatch({ type: 'ask', query: q });

      const sub: StreamSub = { id: null, unsubscribe: () => {} };
      sub.unsubscribe = api.onAiStream((e: AiStreamEvent) => {
        // Ignore events until our streamId is known (a sub-millisecond gap — real
        // deltas are coalesced ~30ms in main, so none are lost), then match it
        // strictly so a stray event from a just-cancelled ask never lands here.
        if (sub.id === null || e.streamId !== sub.id) return;
        if (e.type === 'delta') dispatch({ type: 'delta', query: q, text: e.text });
        else if (e.type === 'done') dispatch({ type: 'resolved', query: q, answer: e.answer });
        else dispatch({ type: 'error', query: q, message: e.message });
      });
      subRef.current = sub;

      void api.askAIStream(q).then(({ streamId }) => {
        // The ask may have been abandoned before the id came back; if so this sub is
        // no longer current — cancel the now-orphaned provider call.
        if (subRef.current !== sub) {
          void api.cancelAiStream(streamId);
          return;
        }
        sub.id = streamId;
      });
    },
    [cancel],
  );

  // Abort any in-flight stream when the component using this hook unmounts.
  useEffect(() => cancel, [cancel]);

  return { phase, ask, reset };
}
