import { describe, it, expect } from 'vitest';
import { RoutineSchema, type DigestBucket, type Routine, type RoutineSourceId } from '@cockpitzero/shared';
import { createDigestRunner, type DigestSummarize } from '../src/main/services/routines/digest-runner.js';
import type { NotificationSource, RawItem } from '../src/main/services/routines/source.js';

/**
 * The digest runner is dependency-inverted (sources + summarizer + clock), so we
 * exercise it with fakes here — no electron, mirroring ai-service.test.ts. The
 * fake summarizer encodes the bucket in each item's text (`now:` / `wait:` /
 * `noise:`) and scores newer items higher, so we can assert assembly precisely.
 */

const NOW = new Date(2026, 5, 22, 8, 42).getTime();

function source(id: RoutineSourceId, items: RawItem[]): NotificationSource {
  return { id, fetch: async () => items };
}

function item(id: string, source: RoutineSourceId, bucket: DigestBucket, ageMin: number): RawItem {
  return {
    id,
    who: id,
    source,
    text: `${bucket}:${id}`,
    timestamp: NOW - ageMin * 60_000,
    openPath: `app://${id}`,
  };
}

/** Reads the bucket back out of the encoded text; score = newer is higher. */
const summarize: DigestSummarize = async (items) =>
  items.map((it) => ({
    id: it.id,
    summary: it.text,
    bucket: it.text.split(':')[0] as DigestBucket,
    score: 10_000 - it.ageMinutes,
  }));

function routine(over: Partial<Routine> = {}): Routine {
  return RoutineSchema.parse({
    id: 'morning_digest',
    label: 'Morning briefing',
    sources: ['slack', 'gmail'],
    rankBy: 'importance',
    summarize: { modelTier: 'mini', maxItems: 4 },
    ...over,
  });
}

describe('createDigestRunner', () => {
  it('groups, ranks, caps, and rolls the rest into noise', async () => {
    const sources = {
      slack: source('slack', [
        item('nowA', 'slack', 'now', 12),
        item('nowC', 'slack', 'now', 120),
        item('waitA', 'slack', 'wait', 180),
        item('noiseA', 'slack', 'noise', 300),
      ]),
      gmail: source('gmail', [
        item('nowB', 'gmail', 'now', 60),
        item('waitB', 'gmail', 'wait', 240),
        item('noiseB', 'gmail', 'noise', 360),
        item('noiseC', 'gmail', 'noise', 420),
      ]),
    };
    const runner = createDigestRunner({ sources, summarize, now: () => NOW });
    const digest = await runner.run(routine());

    expect(digest.total).toBe(8);
    expect(digest.surfaced).toBe(4); // capped at maxItems
    expect(digest.sourceCount).toBe(2);
    expect(digest.title).toBe('Morning briefing');
    expect(digest.updatedAt).toBe('8:42 AM');

    // now is filled first (sorted by score = recency here), then wait gets what's left.
    expect(digest.groups.now.map((i) => i.id)).toEqual(['nowA', 'nowB', 'nowC']);
    expect(digest.groups.wait.map((i) => i.id)).toEqual(['waitA']);
    // 1 overflow wait + 3 noise = 4.
    expect(digest.groups.noiseCount).toBe(4);

    // Item fields are assembled from raw + ranking.
    expect(digest.groups.now[0]).toMatchObject({
      who: 'nowA',
      source: 'slack',
      when: '12m',
      summary: 'now:nowA',
      openPath: 'app://nowA',
    });
  });

  it('orders by recency (not score) when rankBy is recency', async () => {
    // Score disagrees with age: the runner must use the timestamp for recency.
    const reverseScore: DigestSummarize = async (items) =>
      items.map((it) => ({
        id: it.id,
        summary: it.text,
        bucket: 'now' as const,
        score: it.ageMinutes, // older = higher score (the wrong order for recency)
      }));
    const sources = {
      slack: source('slack', [item('old', 'slack', 'now', 300), item('new', 'slack', 'now', 5)]),
    };
    const runner = createDigestRunner({ sources, summarize: reverseScore, now: () => NOW });
    const digest = await runner.run(routine({ sources: ['slack'], rankBy: 'recency' }));

    expect(digest.groups.now.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('degrades to [] for a failing source (one bad source never sinks the run)', async () => {
    const sources = {
      slack: source('slack', [item('ok', 'slack', 'now', 10)]),
      gmail: { id: 'gmail' as const, fetch: async () => Promise.reject(new Error('down')) },
    };
    const runner = createDigestRunner({ sources, summarize, now: () => NOW });
    const digest = await runner.run(routine());

    expect(digest.total).toBe(1);
    expect(digest.groups.now.map((i) => i.id)).toEqual(['ok']);
  });

  it('falls back to the local ranker when the summarizer throws', async () => {
    const sources = {
      slack: source('slack', [
        { ...item('a', 'slack', 'now', 10), text: 'Needs the rollback plan — blocking QA.' },
        { ...item('b', 'slack', 'wait', 20), text: 'A newsletter digest, nothing urgent.' },
      ]),
    };
    const boom: DigestSummarize = async () => {
      throw new Error('provider not configured');
    };
    const runner = createDigestRunner({ sources, summarize: boom, now: () => NOW });
    const digest = await runner.run(routine({ sources: ['slack'] }));

    // The shared keyword ranker still buckets them: one "now", one "noise".
    expect(digest.groups.now.map((i) => i.id)).toEqual(['a']);
    expect(digest.groups.wait).toHaveLength(0);
    expect(digest.groups.noiseCount).toBe(1);
  });
});
