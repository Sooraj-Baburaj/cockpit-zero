import { dirname } from 'node:path';
import { fuzzyRank, toRanges } from '@cockpitzero/shared';
import type { FileItem } from '@cockpitzero/shared';
import type { SearchFiles, SearchProvider } from './provider.js';

/** Below this length a file search is skipped (too broad / too noisy). */
const MIN_QUERY_LENGTH = 2;

/**
 * Provider for files, backed by the OS search index via the injected
 * `searchFiles` adapter. The adapter already filters by name; we fuzzy-rank the
 * returned basenames so the closest match sorts first and we get highlight
 * ranges. Injected for testability (no child_process in tests).
 */
export function createFilesProvider(searchFiles: SearchFiles): SearchProvider {
  return {
    id: 'files',
    async search(query, limit) {
      const q = query.trim();
      if (q.length < MIN_QUERY_LENGTH || limit <= 0) return [];
      const entries = await searchFiles(q, limit);
      return fuzzyRank(q, entries, (entry) => entry.name)
        .slice(0, limit)
        .map(
          ({ item, score, positions }): FileItem => ({
            kind: 'file',
            id: item.path,
            title: item.name,
            subtitle: dirname(item.path),
            path: item.path,
            score,
            matches: toRanges(positions),
          }),
        );
    },
  };
}
