import { describe, it, expect } from 'vitest';
import { ConfigSchema, RoutineSchema } from './schemas.js';
import { defaultConfig } from './config.js';
import {
  cronMatches,
  formatClockTime,
  nextCronRun,
  rankDigestItems,
  relativeTime,
} from './routines.js';
import type { DigestSourceItem } from './types.js';

describe('RoutineSchema', () => {
  it('fills defaults from a minimal routine', () => {
    const r = RoutineSchema.parse({ id: 'r1', label: 'Digest' });
    expect(r.kind).toBe('digest');
    expect(r.enabled).toBe(true);
    expect(r.sources).toEqual([]);
    expect(r.rankBy).toBe('importance');
    expect(r.trigger).toBe('on_demand');
    expect(r.deliver).toBe('launcher');
    expect(r.summarize).toEqual({ modelTier: 'mini', maxItems: 8 });
    expect(r.schedule).toBeUndefined();
  });

  it('rejects a non-positive maxItems', () => {
    expect(RoutineSchema.safeParse({ id: 'r', label: 'l', summarize: { maxItems: 0 } }).success).toBe(
      false,
    );
  });
});

describe('config routines default', () => {
  it('seeds a morning_digest + standup_prep in a fresh config', () => {
    const ids = defaultConfig().routines.map((r) => r.id);
    expect(ids).toContain('morning_digest');
    expect(ids).toContain('standup_prep');
  });

  it('an old config without routines parses to an empty array (additive)', () => {
    const parsed = ConfigSchema.parse({ version: 1 });
    expect(parsed.routines).toEqual([]);
  });
});

describe('relativeTime', () => {
  it('formats sub-minute, minutes, hours, and days', () => {
    expect(relativeTime(0)).toBe('now');
    expect(relativeTime(30_000)).toBe('now');
    expect(relativeTime(12 * 60_000)).toBe('12m');
    expect(relativeTime(3 * 60 * 60_000)).toBe('3h');
    expect(relativeTime(2 * 24 * 60 * 60_000)).toBe('2d');
    expect(relativeTime(-5000)).toBe('now');
  });
});

describe('formatClockTime', () => {
  it('renders a 12-hour wall clock', () => {
    expect(formatClockTime(new Date(2026, 0, 1, 8, 42).getTime())).toBe('8:42 AM');
    expect(formatClockTime(new Date(2026, 0, 1, 0, 5).getTime())).toBe('12:05 AM');
    expect(formatClockTime(new Date(2026, 0, 1, 13, 9).getTime())).toBe('1:09 PM');
    expect(formatClockTime(new Date(2026, 0, 1, 12, 0).getTime())).toBe('12:00 PM');
  });
});

describe('cron', () => {
  it('matches a daily 8:00 schedule', () => {
    expect(cronMatches('0 8 * * *', new Date(2026, 5, 22, 8, 0))).toBe(true);
    expect(cronMatches('0 8 * * *', new Date(2026, 5, 22, 8, 1))).toBe(false);
    expect(cronMatches('0 8 * * *', new Date(2026, 5, 22, 9, 0))).toBe(false);
  });

  it('supports steps and ranges', () => {
    expect(cronMatches('*/15 * * * *', new Date(2026, 5, 22, 10, 30))).toBe(true);
    expect(cronMatches('*/15 * * * *', new Date(2026, 5, 22, 10, 31))).toBe(false);
    expect(cronMatches('0 9-17 * * *', new Date(2026, 5, 22, 12, 0))).toBe(true);
    expect(cronMatches('0 9-17 * * *', new Date(2026, 5, 22, 18, 0))).toBe(false);
  });

  it('rejects a malformed expression', () => {
    expect(cronMatches('not a cron', new Date())).toBe(false);
    expect(cronMatches('0 8 * *', new Date())).toBe(false);
  });

  it('finds the next run strictly after a given instant', () => {
    const from = new Date(2026, 5, 22, 9, 0).getTime();
    const next = nextCronRun('0 8 * * *', from);
    expect(next).not.toBeNull();
    const d = new Date(next!);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(0);
    // The next 8:00 after 9:00 is the following day.
    expect(d.getDate()).toBe(23);
  });

  it('returns null for an impossible schedule', () => {
    // No February 30th.
    expect(nextCronRun('0 0 30 2 *', Date.now())).toBeNull();
  });
});

describe('rankDigestItems', () => {
  const item = (over: Partial<DigestSourceItem>): DigestSourceItem => ({
    id: 'i',
    who: 'X',
    source: 'slack',
    text: '',
    ageMinutes: 10,
    ...over,
  });

  it('buckets by keyword signal', () => {
    const ranked = rankDigestItems(
      [
        item({ id: 'a', text: 'Needs the rollback plan — blocking QA.' }),
        item({ id: 'b', text: 'Two pull requests need review.' }),
        item({ id: 'c', text: 'TLDR newsletter: top stories.' }),
      ],
      { rankBy: 'importance', modelTier: 'mini', maxItems: 8 },
    );
    expect(ranked.find((r) => r.id === 'a')?.bucket).toBe('now');
    expect(ranked.find((r) => r.id === 'b')?.bucket).toBe('wait');
    expect(ranked.find((r) => r.id === 'c')?.bucket).toBe('noise');
  });

  it('scores newer items higher under recency ranking', () => {
    const [newer, older] = rankDigestItems(
      [
        item({ id: 'new', text: 'fyi', ageMinutes: 5 }),
        item({ id: 'old', text: 'fyi', ageMinutes: 600 }),
      ],
      { rankBy: 'recency', modelTier: 'mini', maxItems: 8 },
    );
    expect(newer.score).toBeGreaterThan(older.score);
  });

  it('carries the text through as the summary', () => {
    const [r] = rankDigestItems([item({ text: '  hello  ' })], {
      rankBy: 'importance',
      modelTier: 'mini',
      maxItems: 8,
    });
    expect(r.summary).toBe('hello');
  });
});
