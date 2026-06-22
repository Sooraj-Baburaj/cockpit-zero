import type { DigestRanking, DigestSourceItem, DigestSummarizeOptions } from './types.js';

/**
 * Pure routine helpers (Phase 5) — time formatting, a small cron evaluator, and
 * the deterministic digest ranker. Kept dependency-free in `shared` so the
 * desktop main process (digest runner + scheduler) and the renderer can all reuse
 * them, and so they're unit-testable without `electron` or a clock.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A compact relative-time label ("now" / "12m" / "3h" / "2d") for a delta in ms. */
export function relativeTime(deltaMs: number): string {
  const ms = Math.max(0, deltaMs);
  if (ms < MINUTE_MS) return 'now';
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)}m`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h`;
  return `${Math.floor(ms / DAY_MS)}d`;
}

/** A 12-hour wall-clock label ("8:42 AM") for an epoch-ms instant (local time). */
export function formatClockTime(epochMs: number): string {
  const d = new Date(epochMs);
  const h24 = d.getHours();
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${h12}:${mins} ${period}`;
}

/* ============================================================
   Cron — a minimal 5-field evaluator (minute hour dom month dow)
   ============================================================ */

/**
 * Expand one cron field into the set of values it matches. Supports a star,
 * lists (`a,b`), ranges (`a-b`), and steps (star-slash-n, `a-b/n`). Out-of-range
 * or malformed tokens are ignored; a field that ends up empty never matches.
 */
function expandField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const slash = part.indexOf('/');
    const rangePart = slash === -1 ? part : part.slice(0, slash);
    const stepStr = slash === -1 ? '' : part.slice(slash + 1);
    const step = stepStr === '' ? 1 : Number(stepStr);
    if (!Number.isInteger(step) || step <= 0) continue;

    let lo = min;
    let hi = max;
    if (rangePart !== '*' && rangePart !== '') {
      const dash = rangePart.indexOf('-');
      if (dash === -1) {
        // A bare number; with a step it counts up to `max`, else it's exact.
        lo = Number(rangePart);
        hi = stepStr === '' ? lo : max;
      } else {
        lo = Number(rangePart.slice(0, dash));
        hi = Number(rangePart.slice(dash + 1));
      }
      if (!Number.isInteger(lo) || !Number.isInteger(hi)) continue;
    }
    for (let v = lo; v <= hi; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
  }
  return out;
}

/** Whether a 5-field cron expression matches the given instant (to the minute). */
export function cronMatches(expr: string, date: Date): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [mi, ho, dom, mo, dow] = fields as [string, string, string, string, string];
  return (
    expandField(mi, 0, 59).has(date.getMinutes()) &&
    expandField(ho, 0, 23).has(date.getHours()) &&
    expandField(dom, 1, 31).has(date.getDate()) &&
    expandField(mo, 1, 12).has(date.getMonth() + 1) &&
    expandField(dow, 0, 6).has(date.getDay())
  );
}

/**
 * The next instant (epoch ms, minute-aligned) strictly after `fromMs` at which
 * the cron expression fires, or `null` if it never fires within a year (e.g. an
 * impossible date). Scans minute-by-minute — cheap for the schedules we run
 * (daily/hourly match within a day) and bounded so a bad expression can't loop.
 */
export function nextCronRun(expr: string, fromMs: number): number | null {
  let t = (Math.floor(fromMs / MINUTE_MS) + 1) * MINUTE_MS;
  const limit = 367 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (cronMatches(expr, new Date(t))) return t;
    t += MINUTE_MS;
  }
  return null;
}

/* ============================================================
   Deterministic digest ranker (the offline default + AI fallback)
   ============================================================ */

/** Strong "needs you now" signals. */
const NOW_RE =
  /\b(block(?:ing|ed)?|urgent|asap|rollback|sign[- ]?off|waiting|alert|budget|cutover|cap|overdue|incident|escalat|deadline)\b/i;
/** Low-signal "noise" — newsletters, CI, automated digests. */
const NOISE_RE =
  /\b(newsletter|digest|unsubscribe|ci\b|build passed|passed|automated|weekly|promo|daily digest|dependabot|reminder bot)\b/i;

/**
 * Deterministic summarize + rank, shared by the offline mock provider and the
 * AiService's "AI disabled" fallback (so the digest still works locally). Buckets
 * each item by keyword/recency and scores it; `rankBy: 'recency'` makes time the
 * dominant signal. The summary is the item's own (already one-line) text — a real
 * provider would rewrite it, but the structure is identical, so swapping in the
 * model changes nothing downstream.
 */
export function rankDigestItems(
  items: DigestSourceItem[],
  opts: DigestSummarizeOptions,
): DigestRanking[] {
  return items.map((it) => {
    const text = it.text;
    const bucket = NOISE_RE.test(text) ? 'noise' : NOW_RE.test(text) ? 'now' : 'wait';
    const base = bucket === 'now' ? 0.8 : bucket === 'wait' ? 0.5 : 0.1;
    // Recency in [0, 1]: newer → higher (clamped to a 24h window).
    const recency = 1 - Math.min(it.ageMinutes, 1440) / 1440;
    const score = opts.rankBy === 'recency' ? recency + base * 0.001 : base + recency * 0.2;
    return { id: it.id, summary: text.trim(), bucket, score: Number(score.toFixed(4)) };
  });
}
