import type { LauncherItem, LauncherItemKind } from '@cockpitzero/shared';

/** Render + keyboard-navigation order of the result sections. */
const SECTION_RANK: Record<LauncherItemKind, number> = {
  action: 0,
  workflow: 1,
  app: 2,
  file: 3,
};

/**
 * Merges config results (actions/workflows) with system results (apps, files)
 * into the final launcher list. First deduplicates by id with source priority
 * config > apps > files (an `.app` can surface as both an app and a file — keep
 * the app). Then orders by section (actions → workflows → apps → files), best
 * score first within each, so the renderer can show contiguous, labelled
 * sections while keyboard nav stays a simple flat index. Capped to `limit`.
 */
export function mergeResults(
  config: LauncherItem[],
  apps: LauncherItem[],
  files: LauncherItem[],
  limit: number,
): LauncherItem[] {
  const seen = new Set<string>();
  const deduped: LauncherItem[] = [];
  for (const item of [...config, ...apps, ...files]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  deduped.sort((a, b) => SECTION_RANK[a.kind] - SECTION_RANK[b.kind] || b.score - a.score);
  return deduped.slice(0, limit);
}
