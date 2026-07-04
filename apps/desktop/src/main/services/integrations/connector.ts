import type { IntegrationSourceId } from '@cockpitzero/shared';
import type { RawItem } from '../routines/source.js';

/**
 * Ports for the real integration connectors (production P10). Same dependency
 * inversion as the search providers and notification sources: the service layer
 * *defines* this port, `infra/integrations/*` adapters *implement* it against
 * each service's official SDK, and the integration service / digest sources /
 * agent tools depend only on the injected connectors — so everything above the
 * port is unit-testable with fakes, no network or `electron`.
 */

/** What the vault stores per connected source (JSON under `SecretName.oauth(source)`). */
export interface StoredTokens {
  accessToken: string;
  /** Present when the provider issued one (OAuth with offline access / rotation). */
  refreshToken?: string;
  /** Epoch ms when `accessToken` expires; absent = long-lived credential. */
  expiresAt?: number;
}

/** The result of a connect attempt (OAuth round-trip or pasted token). */
export interface ConnectOutcome {
  ok: boolean;
  tokens?: StoredTokens;
  /** Who connected — e.g. "sooraj@acme.com" or "Sooraj · Acme workspace". */
  accountLabel?: string;
  /** Granted scopes (display metadata). */
  scopes?: string[];
  error?: string;
}

/** A real, OAuth/token-backed connector for one integration source. */
export interface Connector {
  id: IntegrationSourceId;
  /** Whether the OAuth app credentials (client id/secret) are configured here. */
  oauthReady(): boolean;
  /** Run the full system-browser OAuth round-trip (loopback callback). */
  connectOAuth(openExternal: (url: string) => void | Promise<void>): Promise<ConnectOutcome>;
  /** Validate a pasted long-lived credential (PAT / API key / integration secret). */
  connectToken(token: string): Promise<ConnectOutcome>;
  /** Exchange the refresh token for fresh tokens, or null when it can't refresh. */
  refresh(tokens: StoredTokens): Promise<StoredTokens | null>;
  /** Best-effort remote revocation (disconnect clears the vault regardless). */
  revoke(tokens: StoredTokens): Promise<void>;
  /** Pull notifications newer than `since` (epoch ms) mapped to digest raw items.
   *  Absent for write-only connectors (calendar). Callers time-box this. */
  fetchItems?(accessToken: string, since: number): Promise<RawItem[]>;
}
