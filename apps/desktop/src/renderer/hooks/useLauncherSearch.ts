import { useEffect, useState } from 'react';
import type { ResolvedQuery } from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useDebouncedValue } from './useDebouncedValue.js';

const EMPTY: ResolvedQuery = { kind: 'results', results: [] };

/**
 * Resolves launcher input (debounced) into either ranked results or an
 * argument-capture state, via the main process. Stale responses are ignored so
 * fast typing never shows out-of-order results.
 */
export function useLauncherSearch(query: string): ResolvedQuery {
  const debounced = useDebouncedValue(query);
  const [resolved, setResolved] = useState<ResolvedQuery>(EMPTY);

  useEffect(() => {
    let active = true;
    void api.resolveQuery(debounced).then((r) => {
      if (active) setResolved(r);
    });
    return () => {
      active = false;
    };
  }, [debounced]);

  return resolved;
}
