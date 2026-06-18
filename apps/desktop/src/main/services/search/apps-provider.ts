import { fuzzyRank, toRanges } from '@cockpitzero/shared';
import type { AppItem } from '@cockpitzero/shared';
import type { AppEntry, ScanInstalledApps, SearchProvider } from './provider.js';

/** How long a scan of installed apps is reused before refreshing. */
const CACHE_TTL_MS = 60_000;

/**
 * Provider for installed applications. Scanning the filesystem is the slow part,
 * so the list is cached (with a short TTL) and ranking happens in-memory via the
 * shared `fuzzyRank`. The scan function is injected (dependency inversion) so
 * this is unit-testable with a fake app list — no FS access.
 */
export function createAppsProvider(scan: ScanInstalledApps): SearchProvider {
  let cache: AppEntry[] | null = null;
  let loadedAt = 0;
  let inflight: Promise<AppEntry[]> | null = null;

  function loadApps(): Promise<AppEntry[]> {
    if (cache && Date.now() - loadedAt < CACHE_TTL_MS) return Promise.resolve(cache);
    if (!inflight) {
      inflight = scan()
        .then((list) => {
          cache = list;
          loadedAt = Date.now();
          return list;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  }

  return {
    id: 'apps',
    async search(query, limit) {
      const q = query.trim();
      if (q === '' || limit <= 0) return [];
      const list = await loadApps();
      return fuzzyRank(q, list, (app) => app.name)
        .slice(0, limit)
        .map(
          ({ item, score, positions }): AppItem => ({
            kind: 'app',
            id: item.path,
            title: item.name,
            subtitle: 'Application',
            path: item.path,
            score,
            matches: toRanges(positions),
          }),
        );
    },
  };
}
