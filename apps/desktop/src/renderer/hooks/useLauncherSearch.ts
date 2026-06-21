import { useEffect, useState } from 'react';
import type { LauncherItem, ResolvedQuery } from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useDebouncedValue } from './useDebouncedValue.js';

const EMPTY: ResolvedQuery = { kind: 'results', results: [] };
/** Total rows shown (config matches first, then apps/files). */
const RESULT_LIMIT = 12;

/**
 * Resolves launcher input (debounced) into either ranked results or an
 * argument-capture state. Two phases run in parallel: `resolveQuery` returns the
 * configured actions/workflows **instantly**, while `searchSystem` fetches the
 * slower OS-index results (installed apps + files) and merges them in when ready.
 * This keeps configured matches snappy even when Spotlight is slow. Stale
 * responses are ignored so fast typing never shows out-of-order results.
 */
export function useLauncherSearch(query: string): ResolvedQuery {
  const debounced = useDebouncedValue(query);
  const [resolved, setResolved] = useState<ResolvedQuery>(EMPTY);
  const [system, setSystem] = useState<LauncherItem[]>([]);

  useEffect(() => {
    let active = true;
    // Drop stale system results immediately so they don't linger under a new query.
    setSystem([]);

    void api.resolveQuery(debounced).then((r) => {
      if (active) setResolved(r);
    });
    if (debounced.trim() !== '') {
      void api.searchSystem(debounced).then((items) => {
        if (active) setSystem(items);
      });
    }

    return () => {
      active = false;
    };
  }, [debounced]);

  // Only ranked results merge with system rows; an argument-capture state stands
  // alone. Config matches keep priority (the cap drops overflow system rows).
  if (resolved.kind !== 'results' || system.length === 0) return resolved;
  return { kind: 'results', results: [...resolved.results, ...system].slice(0, RESULT_LIMIT) };
}
