import type { Action, SearchResult } from './types.js';

/** URL-friendly slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Small, dependency-free unique id (sufficient for local config entities). */
export function createId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/**
 * Subsequence fuzzy match. Returns a score in [0,1] and the matched index
 * ranges, or null if `query` is not a subsequence of `text`. Powers the
 * launcher's result ranking.
 */
export function fuzzyMatch(
  query: string,
  text: string,
): { score: number; matches: Array<[number, number]> } | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return { score: 0, matches: [] };

  const matches: Array<[number, number]> = [];
  let qi = 0;
  let runStart = -1;
  let consecutive = 0;
  let bonus = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (runStart === -1) runStart = ti;
      consecutive++;
      bonus += consecutive; // reward consecutive runs
      qi++;
    } else if (runStart !== -1) {
      matches.push([runStart, ti]);
      runStart = -1;
      consecutive = 0;
    }
  }
  if (runStart !== -1) matches.push([runStart, runStart + consecutive]);
  if (qi < q.length) return null;

  const score = Math.min(1, bonus / (q.length * q.length) + q.length / t.length / 2);
  return { score, matches };
}

/** Rank actions against a query using fuzzyMatch; best first. */
export function searchActions(query: string, actions: Action[]): SearchResult[] {
  if (query.trim() === '') {
    return actions.map((action) => ({ action, score: 0, matches: [] }));
  }
  return actions
    .map((action) => {
      const m = fuzzyMatch(query, action.title);
      return m ? { action, score: m.score, matches: m.matches } : null;
    })
    .filter((r): r is SearchResult => r !== null)
    .sort((a, b) => b.score - a.score);
}
