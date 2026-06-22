import { useEffect, useState } from 'react';
import type { LauncherItem, ResolvedQuery } from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useDebouncedValue } from './useDebouncedValue.js';

const EMPTY: ResolvedQuery = { kind: 'results', results: [] };
/** Total rows shown (config matches first, then apps/files). */
const RESULT_LIMIT = 12;

export interface LauncherSearch {
  /** Merged config + system resolution for the current query. */
  resolved: ResolvedQuery;
  /** True once BOTH the instant config resolve and the async system search have
   *  settled for the current query. AI mode gates its "Ask AI" offer on this so
   *  the offer never flashes before the slow file index returns. */
  settled: boolean;
}

/**
 * Resolves launcher input (debounced) into either ranked results or an
 * argument-capture state. Two phases run in parallel: `resolveQuery` returns the
 * configured actions/workflows **instantly**, while `searchSystem` fetches the
 * slower OS-index results (installed apps + files) and merges them in when ready.
 * This keeps configured matches snappy even when Spotlight is slow. Stale
 * responses are ignored so fast typing never shows out-of-order results.
 *
 * `settled` reports when both phases have finished for the current query — the
 * AI-mode gate (see `computeLauncherView`) needs to know "really nothing
 * matched", not just "nothing yet".
 */
export function useLauncherSearch(query: string): LauncherSearch {
  const debounced = useDebouncedValue(query);
  const [resolved, setResolved] = useState<ResolvedQuery>(EMPTY);
  const [system, setSystem] = useState<LauncherItem[]>([]);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let active = true;
    // Drop stale system results immediately so they don't linger under a new query.
    setSystem([]);
    setSettled(false);

    const plain = debounced.trim() !== '';
    let configDone = false;
    // An empty query runs no system search, so that phase is trivially complete.
    let systemDone = !plain;
    const markSettled = () => {
      if (active && configDone && systemDone) setSettled(true);
    };

    void api.resolveQuery(debounced).then((r) => {
      if (!active) return;
      setResolved(r);
      configDone = true;
      markSettled();
    });
    if (plain) {
      void api.searchSystem(debounced).then((items) => {
        if (!active) return;
        setSystem(items);
        systemDone = true;
        markSettled();
      });
    }

    return () => {
      active = false;
    };
  }, [debounced]);

  // Only ranked results merge with system rows; an argument-capture state stands
  // alone. Config matches keep priority (the cap drops overflow system rows).
  const merged: ResolvedQuery =
    resolved.kind !== 'results' || system.length === 0
      ? resolved
      : { kind: 'results', results: [...resolved.results, ...system].slice(0, RESULT_LIMIT) };

  // While a keystroke is still debouncing, the query the caller sees is ahead of
  // what we've resolved — treat that as unsettled so AI mode doesn't act on stale
  // results for the previous query.
  return { resolved: merged, settled: settled && query === debounced };
}
