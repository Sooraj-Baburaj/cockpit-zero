import { Fzf } from 'fzf';
import { hasArgument } from './actions.js';
import type { Action, Config, ResolvedQuery, SearchResult } from './types.js';

/**
 * Search + query resolution — the launcher's brain. Ranking is delegated to
 * `fzf` (the same algorithm as the fzf CLI: smart-case, consecutive-run and
 * word-boundary bonuses, sensible tiebreakers), which also returns the matched
 * character positions we turn into highlight ranges.
 */

/** One searchable surface for an action: its title, or an alias keyword/label. */
interface IndexEntry {
  action: Action;
  label: string;
}

/**
 * Flattens config into searchable entries. Each action is searchable by its
 * title and by every alias keyword/label that points to it, so typing `gh` can
 * match the "Open GitHub" action via its `gh` alias.
 */
export function buildSearchIndex(config: Config): IndexEntry[] {
  const byId = new Map(config.actions.map((a) => [a.id, a]));
  const entries: IndexEntry[] = config.actions.map((action) => ({ action, label: action.title }));

  for (const alias of config.aliases) {
    const action = byId.get(alias.actionId);
    if (!action) continue;
    entries.push({ action, label: alias.keyword });
    if (alias.label && alias.label !== alias.keyword) {
      entries.push({ action, label: alias.label });
    }
  }
  return entries;
}

/** Merge a set of matched indices into sorted, half-open `[start, end)` ranges. */
function toRanges(positions: Set<number>): Array<[number, number]> {
  const sorted = [...positions].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (const pos of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === pos) last[1] = pos + 1;
    else ranges.push([pos, pos + 1]);
  }
  return ranges;
}

/**
 * Ranks actions against a query, best first. An empty query returns every
 * action unranked (the launcher's resting state). Results are deduplicated by
 * action id, keeping the highest-scoring matched surface.
 */
export function searchActions(query: string, config: Config): SearchResult[] {
  const q = query.trim();
  if (q === '') {
    return config.actions.map((action) => ({ action, score: 0, matches: [], label: action.title }));
  }

  const entries = buildSearchIndex(config);
  const fzf = new Fzf(entries, { selector: (e) => e.label });

  const best = new Map<string, SearchResult>();
  for (const result of fzf.find(q)) {
    const { action, label } = result.item;
    const existing = best.get(action.id);
    if (!existing || result.score > existing.score) {
      best.set(action.id, {
        action,
        score: result.score,
        matches: toRanges(result.positions),
        label,
      });
    }
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}

/**
 * Interprets raw launcher input. When the leading token (text before the first
 * space) is the keyword of a parameterized action, switches to "argument
 * capture" so the rest of the input becomes the action's argument (Level 2).
 * Otherwise falls back to a normal ranked search.
 */
export function resolveQuery(input: string, config: Config): ResolvedQuery {
  const trimmed = input.replace(/^\s+/, '');
  const spaceIdx = trimmed.indexOf(' ');

  if (spaceIdx > 0) {
    const keyword = trimmed.slice(0, spaceIdx);
    const argument = trimmed.slice(spaceIdx + 1);
    const alias = config.aliases.find((a) => a.keyword.toLowerCase() === keyword.toLowerCase());
    if (alias) {
      const action = config.actions.find((a) => a.id === alias.actionId);
      if (action && hasArgument(action)) {
        return { kind: 'argument', action, keyword: alias.keyword, argument };
      }
    }
  }

  return { kind: 'results', results: searchActions(input, config) };
}
