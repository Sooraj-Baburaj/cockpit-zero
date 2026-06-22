import type { RoutineSourceId } from '@cockpitzero/shared';

/**
 * Ports for routine notification sources (Phase 5). Following the same
 * dependency-inversion as the search providers: the service layer *defines* this
 * port, `infra/routines/*` adapters *implement* it (mock canned data now, real
 * Slack/Gmail/etc. integrations later), and the digest runner depends only on the
 * injected sources — so the runner is unit-testable with fakes, no `electron` or
 * network required.
 */

/** A raw, unsummarized notification pulled from a source. */
export interface RawItem {
  /** Stable id (used to join the AI ranking back to the item). */
  id: string;
  /** Who/what it's from, e.g. "Priya Shah". */
  who: string;
  /** Which source produced it (the digest row's badge). */
  source: RoutineSourceId;
  /** Raw notification text — the only thing sent to the summarizer. */
  text: string;
  /** When it arrived (epoch ms) — drives recency ranking + the relative label. */
  timestamp: number;
  /** Deep link / app path to open it (`↵ open`), when available. */
  openPath?: string;
}

/**
 * A pluggable notification source. `fetch(since)` returns items newer than the
 * given instant. Implementations must be time-boxed and degrade to `[]` on
 * failure (same discipline as the search providers) so one slow/broken source
 * never blocks a digest run.
 */
export interface NotificationSource {
  id: RoutineSourceId;
  fetch(since: number): Promise<RawItem[]>;
}
