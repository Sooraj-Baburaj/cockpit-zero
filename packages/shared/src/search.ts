import { Fzf } from 'fzf';
import { effectiveArguments, hasArgument, splitArgumentValues } from './actions.js';
import type { ActionItem, Config, LauncherItem, ResolvedQuery, WorkflowItem } from './types.js';

/**
 * Search + query resolution — the launcher's brain. Ranking is delegated to
 * `fzf` (the same algorithm as the fzf CLI: smart-case, consecutive-run and
 * word-boundary bonuses, sensible tiebreakers), which also returns the matched
 * character positions we turn into highlight ranges.
 *
 * Everything here is **pure and config-only**: it never touches the OS. System
 * results (installed apps, files) are produced by providers in the desktop main
 * process and merged with these — see `apps/desktop/src/main/services/search`.
 */

/** One ranked result from `fuzzyRank`. */
export interface RankResult<T> {
  item: T;
  /** Relative match score; higher is better. */
  score: number;
  /** Matched character indices within the selected string. */
  positions: Set<number>;
}

/**
 * Damerau–Levenshtein edit distance (with transpositions), capped: once the
 * running minimum exceeds `max` it bails early returning `max + 1`. Used only for
 * the typo-tolerant fallback below, so it stays cheap on the common path.
 */
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const prev2: number[] = [];
  let prev: number[] = [];
  let curr: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2]! + 1); // transposition
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2.length = 0;
    prev2.push(...prev);
    prev = curr;
  }
  return prev[b.length]!;
}

/** Edit-distance budget for a query of the given length (longer query → more
 *  slack), so a one-character typo in a short word still matches. */
function typoBudget(len: number): number {
  if (len < 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

/**
 * Typo-tolerant matches for items fzf missed. Compares the query against each
 * item's words (and the whole string) by bounded edit distance, keeping those
 * within budget. No highlight positions (the match isn't a subsequence), and a
 * negative score so these always sort *after* genuine fzf matches.
 */
function typoFallback<T>(
  query: string,
  items: T[],
  selector: (item: T) => string,
): RankResult<T>[] {
  const q = query.toLowerCase();
  const budget = typoBudget(q.length);
  const out: RankResult<T>[] = [];
  for (const item of items) {
    const text = selector(item).toLowerCase();
    if (text.length === 0) continue;
    let best = budget + 1;
    for (const word of text.split(/[^a-z0-9]+/)) {
      if (!word) continue;
      best = Math.min(best, boundedEditDistance(q, word, budget));
      if (best === 0) break;
    }
    if (best > budget && text.length <= q.length + budget) {
      best = Math.min(best, boundedEditDistance(q, text, budget));
    }
    if (best <= budget) out.push({ item, score: -1000 - best, positions: new Set<number>() });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Generic fuzzy ranker over any list — reused for actions/workflows, apps and
 * files so every source shares fzf's ranking. An empty query returns the items
 * unranked (score 0), which callers use as a resting state. Items fzf doesn't
 * match get a typo-tolerant second pass (so `chrtme` still finds "Chrome"),
 * appended after the exact subsequence matches.
 */
export function fuzzyRank<T>(
  query: string,
  items: T[],
  selector: (item: T) => string,
): RankResult<T>[] {
  if (query.trim() === '') {
    return items.map((item) => ({ item, score: 0, positions: new Set<number>() }));
  }
  // Wrap in a concrete object shape so fzf's overloaded constructor resolves the
  // `selector` form for any generic `T` (it can't infer it from a bare `T[]`).
  const fzf = new Fzf(
    items.map((item) => ({ item, key: selector(item) })),
    { selector: (entry) => entry.key },
  );
  const matched = fzf
    .find(query)
    .map((r) => ({ item: r.item.item, score: r.score, positions: r.positions }));

  const hit = new Set(matched.map((r) => r.item));
  const typos = typoFallback(
    query,
    items.filter((item) => !hit.has(item)),
    selector,
  );
  return [...matched, ...typos];
}

/** Merge matched indices into sorted, half-open `[start, end)` ranges. */
export function toRanges(positions: Set<number>): Array<[number, number]> {
  const sorted = [...positions].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (const pos of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === pos) last[1] = pos + 1;
    else ranges.push([pos, pos + 1]);
  }
  return ranges;
}

/** The launcher's resting list: every configured action and workflow, unranked. */
function configItems(config: Config): LauncherItem[] {
  const actions: ActionItem[] = config.actions.map((action) => ({
    kind: 'action',
    id: action.id,
    title: action.title,
    score: 0,
    matches: [],
    action,
  }));
  const workflows: WorkflowItem[] = config.workflows.map((workflow) => ({
    kind: 'workflow',
    id: workflow.id,
    title: workflow.name,
    score: 0,
    matches: [],
    workflow,
  }));
  return [...actions, ...workflows];
}

/**
 * One searchable surface pointing back at a config entity by id. Each action is
 * searchable by its title and by every alias keyword/label that targets it (so
 * typing `gh` matches "Open GitHub" via its `gh` alias); workflows by name.
 * `isTitle` marks the display surface, so highlights only render on the title.
 */
interface Surface {
  id: string;
  text: string;
  isTitle: boolean;
}

function configSurfaces(config: Config): Surface[] {
  const actionIds = new Set(config.actions.map((a) => a.id));
  const surfaces: Surface[] = [];

  for (const action of config.actions) {
    surfaces.push({ id: action.id, text: action.title, isTitle: true });
  }
  for (const workflow of config.workflows) {
    surfaces.push({ id: workflow.id, text: workflow.name, isTitle: true });
  }
  for (const alias of config.aliases) {
    if (!actionIds.has(alias.actionId)) continue;
    surfaces.push({ id: alias.actionId, text: alias.keyword, isTitle: false });
    if (alias.label && alias.label !== alias.keyword) {
      surfaces.push({ id: alias.actionId, text: alias.label, isTitle: false });
    }
  }
  return surfaces;
}

/**
 * Ranks the user's configured actions and workflows against a query, best first.
 * An empty query returns every item unranked (the launcher's resting state).
 * Deduplicated by id, keeping the highest-scoring matched surface; highlight
 * ranges are produced only when the title itself matched.
 */
export function searchConfig(query: string, config: Config): LauncherItem[] {
  const items = configItems(config);
  if (query.trim() === '') return items;

  const best = new Map<string, { score: number; positions: Set<number>; isTitle: boolean }>();
  for (const { item: surface, score, positions } of fuzzyRank(
    query,
    configSurfaces(config),
    (s) => s.text,
  )) {
    const current = best.get(surface.id);
    if (!current || score > current.score) {
      best.set(surface.id, { score, positions, isTitle: surface.isTitle });
    }
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const out: LauncherItem[] = [];
  for (const [id, match] of best) {
    const base = byId.get(id);
    if (!base) continue;
    out.push({
      ...base,
      score: match.score,
      matches: match.isTitle ? toRanges(match.positions) : [],
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Ranks just the configured actions (workflows excluded). */
export function searchActions(query: string, config: Config): ActionItem[] {
  return searchConfig(query, config).filter((item): item is ActionItem => item.kind === 'action');
}

/**
 * Interprets raw launcher input. When the leading token (text before the first
 * space) is the keyword of a parameterized action, switches to "argument
 * capture" so the rest of the input becomes the action's argument (Level 2).
 * Otherwise falls back to a ranked search over config (actions + workflows); the
 * desktop main process merges in system results (apps/files) for non-empty input.
 */
export function resolveQuery(input: string, config: Config): ResolvedQuery {
  const trimmed = input.replace(/^\s+/, '');
  const spaceIdx = trimmed.indexOf(' ');

  if (spaceIdx > 0) {
    const keyword = trimmed.slice(0, spaceIdx);
    const rest = trimmed.slice(spaceIdx + 1);
    const alias = config.aliases.find((a) => a.keyword.toLowerCase() === keyword.toLowerCase());
    if (alias) {
      const action = config.actions.find((a) => a.id === alias.actionId);
      if (action && hasArgument(action)) {
        const { values, activeIndex } = splitArgumentValues(
          effectiveArguments(action).length,
          rest,
        );
        return { kind: 'argument', action, keyword: alias.keyword, values, activeIndex };
      }
    }
  }

  return { kind: 'results', results: searchConfig(input, config) };
}
