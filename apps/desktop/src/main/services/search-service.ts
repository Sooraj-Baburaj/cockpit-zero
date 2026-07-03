import { resolveQuery, type LauncherItem, type ResolvedQuery } from '@cockpitzero/shared';
import { readConfig } from '../infra/store.js';
import { scanInstalledApps } from '../infra/app-scanner.js';
import { searchFiles } from '../infra/file-search.js';
import { createAppsProvider } from './search/apps-provider.js';
import { createFilesProvider } from './search/files-provider.js';
import { mergeResults } from './search/aggregate.js';
import { frecencyBooster } from './usage-service.js';

/** Total rows shown, and per-source caps for system results. */
const RESULT_LIMIT = 12;
const APP_LIMIT = 6;
const FILE_LIMIT = 6;
const SYSTEM_LIMIT = APP_LIMIT + FILE_LIMIT;

// Providers are created once. The apps provider caches its (slow) FS scan
// internally; the infra adapters are injected so the providers stay testable.
const appsProvider = createAppsProvider(scanInstalledApps);
const filesProvider = createFilesProvider(searchFiles);

/** Frecency nudge: most-/recently-used float up. A small per-item bump —
 *  dominant for the resting list (all base score 0), a tiebreaker among matches. */
function applyFrecency(items: LauncherItem[]): LauncherItem[] {
  const boost = frecencyBooster();
  return items.map((item) => ({ ...item, score: item.score + boost(item.id) }));
}

/**
 * Config search use-case — **synchronous and instant**. The shared resolver makes
 * the pure decision (argument capture / Level 2 vs ranked config results), reading
 * config fresh each call. System results (installed apps + files) are deliberately
 * NOT awaited here — they fan out separately via `searchSystem`, so the slow OS
 * index can never delay the configured actions/workflows from appearing.
 */
export function resolveLauncherQuery(input: string): ResolvedQuery {
  const resolved = resolveQuery(input, readConfig());
  if (resolved.kind !== 'results') return resolved;

  // Resting state (empty query): the config list ordered purely by frecency.
  if (input.trim() === '') {
    const ranked = applyFrecency(resolved.results).sort((a, b) => b.score - a.score);
    return { kind: 'results', results: ranked };
  }

  // Non-empty: section-order + cap the config matches (apps/files arrive later).
  return {
    kind: 'results',
    results: mergeResults(applyFrecency(resolved.results), [], [], RESULT_LIMIT),
  };
}

/**
 * System search (Level 4): installed apps + files for a plain query, fanned out in
 * parallel and merged (deduped + section-ordered apps → files). A slow or failing
 * provider never blocks (allSettled + per-adapter timeouts) — and since this is a
 * separate IPC call, even a 1.5s Spotlight miss leaves the config results onscreen.
 */
export async function searchSystem(input: string): Promise<LauncherItem[]> {
  if (input.trim() === '') return [];

  const [appsResult, filesResult] = await Promise.allSettled([
    appsProvider.search(input, APP_LIMIT),
    filesProvider.search(input, FILE_LIMIT),
  ]);
  const apps = appsResult.status === 'fulfilled' ? appsResult.value : [];
  const files = filesResult.status === 'fulfilled' ? filesResult.value : [];

  return mergeResults([], applyFrecency(apps), applyFrecency(files), SYSTEM_LIMIT);
}
