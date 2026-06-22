import { rankDigestItems, relativeTime, formatClockTime } from '@cockpitzero/shared';
import type {
  Digest,
  DigestItem,
  DigestRanking,
  DigestSourceItem,
  DigestSummarizeOptions,
  Routine,
  RoutineSourceId,
} from '@cockpitzero/shared';
import type { NotificationSource, RawItem } from './source.js';

/**
 * The digest runner (Phase 5) — pure with respect to `electron`. Given a routine
 * it fans out to that routine's sources in parallel, hands the collected items to
 * the injected summarize/rank step, then assembles the grouped + capped `Digest`
 * the briefing surface renders. The summarizer and clock are injected so this is
 * unit-testable with fakes (mirrors how the search providers take their adapters).
 */

/** The summarize/rank step (production passes `aiService.summarizeDigest`). */
export type DigestSummarize = (
  items: DigestSourceItem[],
  opts: DigestSummarizeOptions,
) => Promise<DigestRanking[]>;

export interface DigestRunnerDeps {
  /** Source adapters keyed by id. A routine source with no adapter contributes []. */
  sources: Partial<Record<RoutineSourceId, NotificationSource>>;
  /** Summarize + rank step; falls back to the local ranker if it throws. */
  summarize: DigestSummarize;
  /** Current time (epoch ms) — injected so runs are deterministic in tests. */
  now: () => number;
  /** How far back to pull (ms). Default 24h. */
  windowMs?: number;
}

export interface DigestRunner {
  run(routine: Routine): Promise<Digest>;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function createDigestRunner({
  sources,
  summarize,
  now,
  windowMs = DEFAULT_WINDOW_MS,
}: DigestRunnerDeps): DigestRunner {
  return {
    async run(routine) {
      const nowMs = now();
      const since = nowMs - windowMs;

      // Fan out to the routine's sources; a failing/slow source degrades to [].
      const settled = await Promise.allSettled(
        routine.sources.map((id) => sources[id]?.fetch(since) ?? Promise.resolve<RawItem[]>([])),
      );
      const raw = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      const total = raw.length;
      const byId = new Map(raw.map((it) => [it.id, it]));

      const opts: DigestSummarizeOptions = {
        rankBy: routine.rankBy,
        modelTier: routine.summarize.modelTier,
        maxItems: routine.summarize.maxItems,
      };

      // Minimal, privacy-conscious payload — just text + age, never raw objects.
      const sourceItems: DigestSourceItem[] = raw.map((it) => ({
        id: it.id,
        who: it.who,
        source: it.source,
        text: it.text,
        ageMinutes: Math.max(0, Math.round((nowMs - it.timestamp) / 60_000)),
      }));

      // The model summarizes + ranks; if it throws (e.g. an unconfigured provider)
      // fall back to the on-device ranker so a background run still produces a digest.
      let rankings: DigestRanking[];
      try {
        rankings = await summarize(sourceItems, opts);
      } catch {
        rankings = rankDigestItems(sourceItems, opts);
      }

      const items: DigestItem[] = rankings.flatMap((r) => {
        const it = byId.get(r.id);
        if (!it) return [];
        return [
          {
            id: r.id,
            who: it.who,
            source: it.source,
            summary: r.summary,
            when: relativeTime(nowMs - it.timestamp),
            bucket: r.bucket,
            score: r.score,
            ...(it.openPath ? { openPath: it.openPath } : {}),
          },
        ];
      });

      // Order within a group: recency uses the raw timestamp; importance the score.
      const tsOf = (item: DigestItem) => byId.get(item.id)?.timestamp ?? 0;
      const sortGroup = (arr: DigestItem[]) =>
        [...arr].sort(
          routine.rankBy === 'recency' ? (a, b) => tsOf(b) - tsOf(a) : (a, b) => b.score - a.score,
        );

      const nowGroup = sortGroup(items.filter((i) => i.bucket === 'now'));
      const waitGroup = sortGroup(items.filter((i) => i.bucket === 'wait'));

      // Cap the surfaced items (now first, then wait); the rest — overflow + every
      // noise-bucketed item — roll into the noise count ("X of Y surfaced").
      const ranked = [...nowGroup, ...waitGroup];
      const surfaced = ranked.slice(0, routine.summarize.maxItems);
      const kept = new Set(surfaced.map((i) => i.id));

      return {
        routineId: routine.id,
        title: routine.label,
        updatedAt: formatClockTime(nowMs),
        sourceCount: routine.sources.length,
        surfaced: surfaced.length,
        total,
        groups: {
          now: nowGroup.filter((i) => kept.has(i.id)),
          wait: waitGroup.filter((i) => kept.has(i.id)),
          noiseCount: total - surfaced.length,
        },
      };
    },
  };
}
