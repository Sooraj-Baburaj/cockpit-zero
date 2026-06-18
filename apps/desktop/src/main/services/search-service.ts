import { resolveQuery, type ResolvedQuery } from '@cockpitzero/shared';
import { readConfig } from '../infra/store.js';
import { scanInstalledApps } from '../infra/app-scanner.js';
import { searchFiles } from '../infra/file-search.js';
import { createAppsProvider } from './search/apps-provider.js';
import { createFilesProvider } from './search/files-provider.js';
import { mergeResults } from './search/aggregate.js';

/** Total rows shown, and per-source caps for system results. */
const RESULT_LIMIT = 12;
const APP_LIMIT = 6;
const FILE_LIMIT = 6;

// Providers are created once. The apps provider caches its (slow) FS scan
// internally; the infra adapters are injected so the providers stay testable.
const appsProvider = createAppsProvider(scanInstalledApps);
const filesProvider = createFilesProvider(searchFiles);

/**
 * Search use-case. The shared resolver makes the pure decision — argument capture
 * (Level 2) vs ranked config results — reading config fresh each call. For a
 * non-empty plain query we additionally fan out to the system providers
 * (installed apps + files) in parallel and merge everything, so typing something
 * that isn't a configured action still surfaces useful results (Level 4). A slow
 * or failing provider never blocks the bar (allSettled + per-adapter timeouts).
 */
export async function resolveLauncherQuery(input: string): Promise<ResolvedQuery> {
  const resolved = resolveQuery(input, readConfig());
  if (resolved.kind !== 'results' || input.trim() === '') return resolved;

  const [appsResult, filesResult] = await Promise.allSettled([
    appsProvider.search(input, APP_LIMIT),
    filesProvider.search(input, FILE_LIMIT),
  ]);
  const apps = appsResult.status === 'fulfilled' ? appsResult.value : [];
  const files = filesResult.status === 'fulfilled' ? filesResult.value : [];

  return { kind: 'results', results: mergeResults(resolved.results, apps, files, RESULT_LIMIT) };
}
