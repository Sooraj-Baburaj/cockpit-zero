import type { RoutineSourceId } from '@cockpitzero/shared';
import type { NotificationSource, RawItem } from '../../services/routines/source.js';

/**
 * Offline, deterministic notification sources (Phase 5) — the dev + test default,
 * standing in for real Slack/Gmail/Teams/Linear/GitHub/Notion integrations until
 * those adapters land behind the same `NotificationSource` port. Each item is
 * canned (no network), with an age so recency ranking + relative times are
 * realistic, and an `openPath` to the source's web app so `↵ open` does something
 * safe. The text is written so the shared keyword ranker buckets it as intended
 * (the people/sources mirror `routine-digest.html`).
 */

interface Canned {
  id: string;
  who: string;
  source: RoutineSourceId;
  text: string;
  /** Minutes ago this arrived. */
  ageMinutes: number;
}

/** Where each source's `↵ open` lands (its web app). */
const SOURCE_HOME: Record<RoutineSourceId, string> = {
  slack: 'https://app.slack.com/client',
  gmail: 'https://mail.google.com',
  teams: 'https://teams.microsoft.com',
  linear: 'https://linear.app',
  github: 'https://github.com',
  notion: 'https://www.notion.so',
};

/* 3 "needs you now", 5 "can wait", 12 noise — so a default digest surfaces 8 and
   rolls 12 into the noise card, matching the mockup's "12 low-priority items". */
const CANNED: Canned[] = [
  // Needs you now
  {
    id: 'm-priya',
    who: 'Priya Shah',
    source: 'slack',
    text: 'Needs the rollback plan before the Helix CDN cutover — blocking QA.',
    ageMinutes: 12,
  },
  {
    id: 'm-aws',
    who: 'AWS Billing',
    source: 'gmail',
    text: 'Budget alert: production spend hit 92% of the monthly cap.',
    ageMinutes: 60,
  },
  {
    id: 'm-marcus',
    who: 'Marcus · Design',
    source: 'teams',
    text: 'Waiting on final sign-off for the digest mockups before handoff.',
    ageMinutes: 120,
  },
  // Can wait
  {
    id: 'm-linear',
    who: 'Linear',
    source: 'linear',
    text: 'Four issues assigned to you this sprint, none scheduled for today.',
    ageMinutes: 180,
  },
  {
    id: 'm-github',
    who: 'GitHub',
    source: 'github',
    text: 'Two pull requests need review in cockpit-zero.',
    ageMinutes: 240,
  },
  {
    id: 'm-notion',
    who: 'Notion',
    source: 'notion',
    text: 'Three docs updated in the Apollo workspace this week.',
    ageMinutes: 300,
  },
  {
    id: 'm-dana',
    who: 'Dana Okafor',
    source: 'slack',
    text: 'Shared the Q3 planning thread for your input when you get a moment.',
    ageMinutes: 200,
  },
  {
    id: 'm-allhands',
    who: 'Engineering',
    source: 'teams',
    text: 'The all-hands recording is ready to watch.',
    ageMinutes: 420,
  },
  // Noise (newsletters, CI passes, automated digests)
  {
    id: 'n-tldr',
    who: 'TLDR',
    source: 'gmail',
    text: 'TLDR newsletter: today’s top engineering stories.',
    ageMinutes: 350,
  },
  {
    id: 'n-ph',
    who: 'Product Hunt',
    source: 'gmail',
    text: 'Product Hunt daily digest is here.',
    ageMinutes: 380,
  },
  {
    id: 'n-stripe',
    who: 'Stripe',
    source: 'gmail',
    text: 'Your weekly payments digest.',
    ageMinutes: 500,
  },
  {
    id: 'n-medium',
    who: 'Medium',
    source: 'gmail',
    text: 'Medium Daily Digest: stories picked for you.',
    ageMinutes: 560,
  },
  {
    id: 'n-promo',
    who: 'Promo Weekly',
    source: 'gmail',
    text: 'Unsubscribe confirmation from Promo Weekly.',
    ageMinutes: 640,
  },
  {
    id: 'n-ci-main',
    who: 'GitHub Actions',
    source: 'github',
    text: 'CI build passed on main — all checks green.',
    ageMinutes: 90,
  },
  {
    id: 'n-ci-rel',
    who: 'GitHub Actions',
    source: 'github',
    text: 'CI build passed on the release branch.',
    ageMinutes: 150,
  },
  {
    id: 'n-dependabot',
    who: 'Dependabot',
    source: 'github',
    text: 'Dependabot weekly dependency digest.',
    ageMinutes: 700,
  },
  {
    id: 'n-ci-pr',
    who: 'GitHub Actions',
    source: 'github',
    text: 'Build passed for PR #482.',
    ageMinutes: 110,
  },
  {
    id: 'n-standup',
    who: 'Reminder Bot',
    source: 'slack',
    text: 'Reminder bot: standup automated summary posted.',
    ageMinutes: 260,
  },
  {
    id: 'n-viva',
    who: 'Viva Insights',
    source: 'teams',
    text: 'Your weekly digest is ready.',
    ageMinutes: 800,
  },
  {
    id: 'n-notion-act',
    who: 'Notion',
    source: 'notion',
    text: 'Weekly workspace activity digest.',
    ageMinutes: 900,
  },
];

/** Build a source from its canned items. Stamps a real timestamp at fetch time so
 *  relative ages stay current; degrades to [] on any failure (port discipline). */
function createMockSource(id: RoutineSourceId): NotificationSource {
  const items = CANNED.filter((c) => c.source === id);
  return {
    id,
    async fetch(since) {
      try {
        const nowMs = Date.now();
        return items
          .map<RawItem>((c) => ({
            id: c.id,
            who: c.who,
            source: c.source,
            text: c.text,
            timestamp: nowMs - c.ageMinutes * 60_000,
            openPath: SOURCE_HOME[c.source],
          }))
          .filter((it) => it.timestamp >= since);
      } catch {
        return [];
      }
    },
  };
}

const ALL_SOURCE_IDS: RoutineSourceId[] = ['slack', 'gmail', 'teams', 'linear', 'github', 'notion'];

/** All mock sources, keyed by id (the shape the digest runner injects). */
export function createMockSources(): Record<RoutineSourceId, NotificationSource> {
  return Object.fromEntries(ALL_SOURCE_IDS.map((id) => [id, createMockSource(id)])) as Record<
    RoutineSourceId,
    NotificationSource
  >;
}
