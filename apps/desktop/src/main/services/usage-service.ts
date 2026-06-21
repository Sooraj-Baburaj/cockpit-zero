import Store from 'electron-store';

/**
 * Frecency tracking. Every run (action / workflow / opened path) is recorded by
 * its stable id, and the launcher uses the resulting score to float the things
 * you use most/most-recently to the top — both in the resting list (empty query)
 * and as a tiebreaker among comparable text matches.
 *
 * "Frecency" = frequency × recency: a high run count matters, but a recent run
 * matters more, so habits adapt over time. Persisted separately from `config`
 * (it's local telemetry, not synced settings).
 */
interface UsageEntry {
  count: number;
  lastUsed: number;
}

const store = new Store<{ usage: Record<string, UsageEntry> }>({
  name: 'usage',
  defaults: { usage: {} },
});

/** Record one run of `id` (now). */
export function recordUse(id: string): void {
  const usage = store.get('usage');
  const prev = usage[id];
  usage[id] = { count: (prev?.count ?? 0) + 1, lastUsed: Date.now() };
  store.set('usage', usage);
}

/** Raw frecency for an id: run count weighted up for recency (0 if never run). */
function rawFrecency(entry: UsageEntry | undefined): number {
  if (!entry) return 0;
  const ageHours = (Date.now() - entry.lastUsed) / 3_600_000;
  // recency ∈ (0, 1]: 1 just now, 0.5 a day ago, decaying after.
  const recency = 1 / (1 + ageHours / 24);
  return entry.count * (0.5 + recency);
}

/**
 * A ranking nudge in [0, 0.5) for `id`. Small on purpose: added to integer fzf
 * scores it only reorders comparable matches, but for the resting list (all base
 * score 0) it still sorts most-used first. Returns a function over a snapshot so
 * a whole result set is scored against one read of the store.
 */
export function frecencyBooster(): (id: string) => number {
  const usage = store.get('usage');
  return (id: string) => {
    const raw = rawFrecency(usage[id]);
    return raw === 0 ? 0 : (0.5 * raw) / (raw + 5);
  };
}
