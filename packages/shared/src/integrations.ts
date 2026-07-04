import type { IntegrationSourceId, RoutineSourceId } from './types.js';

/**
 * Pure integration helpers (production P10) — no React, no `electron`, shared by
 * the desktop main process (connectors, integration service), the renderer
 * (Console → Integrations panel), and the backend (`/integrations` route). The
 * connector *implementations* live in `apps/desktop/src/main/infra/integrations`;
 * only the catalog + display metadata live here (mirrors how `task.ts` holds the
 * agent tool catalog while the tools live in the desktop app).
 */

/** Every connectable source, in Console display order (the P10 priority order). */
export const INTEGRATION_SOURCE_IDS = [
  'slack',
  'gmail',
  'calendar',
  'github',
  'linear',
  'notion',
] as const;

/** Human label per source (row titles + digest badges). */
export const integrationSourceLabel: Record<IntegrationSourceId, string> = {
  slack: 'Slack',
  gmail: 'Gmail',
  calendar: 'Google Calendar',
  github: 'GitHub',
  linear: 'Linear',
  notion: 'Notion',
};

/**
 * How each source can be connected. `oauth` sources run the system-browser
 * OAuth flow (needs the OAuth app's client id/secret configured on the machine);
 * `token` sources accept a pasted long-lived credential — a first-class,
 * officially supported auth path for those services (GitHub PATs, Linear API
 * keys, Notion internal-integration secrets, Slack user/bot tokens).
 */
export interface IntegrationCapabilities {
  oauth: boolean;
  token: boolean;
  /** Placeholder/hint for the pasted credential, when `token` is true. */
  tokenHint?: string;
}

export const INTEGRATION_CAPABILITIES: Record<IntegrationSourceId, IntegrationCapabilities> = {
  slack: { oauth: true, token: true, tokenHint: 'User OAuth token (xoxp-…)' },
  gmail: { oauth: true, token: false },
  calendar: { oauth: true, token: false },
  github: { oauth: true, token: true, tokenHint: 'Personal access token (ghp_… / github_pat_…)' },
  linear: { oauth: false, token: true, tokenHint: 'Personal API key (lin_api_…)' },
  notion: { oauth: false, token: true, tokenHint: 'Internal integration secret (ntn_…)' },
};

/**
 * What `connectionStatus()` resolves per source — connection metadata (never a
 * token) plus what the Console needs to render the right connect affordance
 * (`oauthReady` = the OAuth app credentials are configured on this machine).
 */
export interface ConnectionStatus {
  source: IntegrationSourceId;
  connected: boolean;
  account?: string;
  scopes?: string[];
  connectedAt?: string;
  /** Whether the OAuth connect button can work right now (client id/secret set). */
  oauthReady: boolean;
  /** Last connect/fetch error, for the panel's error line. */
  error?: string;
}

/**
 * Which integration backs each routine notification source. `teams` has no
 * connector yet (no adapter ⇒ contributes nothing to a digest); `calendar` is an
 * integration but not a notification source (it backs the agent's event tool).
 */
export const ROUTINE_SOURCE_INTEGRATION: Record<RoutineSourceId, IntegrationSourceId | null> = {
  slack: 'slack',
  gmail: 'gmail',
  teams: null,
  linear: 'linear',
  github: 'github',
  notion: 'notion',
};
