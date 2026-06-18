import { resolveQuery, type ResolvedQuery } from '@cockpitzero/shared';
import { readConfig } from '../infra/store.js';

/**
 * Search use-case. Resolves raw launcher input against the current config using
 * the shared resolver (ranked results or an argument-capture state). Reads
 * config fresh each call so the launcher always reflects the latest edits.
 */
export function resolveLauncherQuery(input: string): ResolvedQuery {
  return resolveQuery(input, readConfig());
}
