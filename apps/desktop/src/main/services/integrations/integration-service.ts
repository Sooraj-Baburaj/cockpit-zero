import { INTEGRATION_SOURCE_IDS, SecretName } from '@cockpitzero/shared';
import type { Config, ConnectionStatus, IntegrationSourceId } from '@cockpitzero/shared';
import type { Connector, StoredTokens } from './connector.js';

/**
 * The integration service (production P10) — connect / disconnect / status /
 * token access for every source, behind injected ports so the rules here stay
 * unit-testable with fakes (no `electron`, no network). The invariants:
 *
 *   - **Tokens live only in the vault** (`SecretName.oauth(source)`, one JSON
 *     `StoredTokens` blob each) — never in the synced config; the config holds
 *     only display metadata (`connections`).
 *   - `accessToken()` is **in-process only** (digest sources + agent tools);
 *     the IPC layer exposes connect/disconnect/status, never a token read.
 *   - Disconnect revokes remotely (best-effort) and always clears locally.
 *   - Signed-in users mirror tokens to the backend (encrypted server-side) so
 *     cloud routines can run; every cloud call is best-effort and non-blocking.
 */

/** The slice of the secrets vault this service needs (SecretsService satisfies it). */
export interface IntegrationVault {
  set(name: string, value: string): { ok: boolean };
  get(name: string): string | null;
  delete(name: string): { ok: boolean };
}

/** Server-side token mirror for signed-in users (a no-op stub when signed out). */
export interface CloudTokenStore {
  push(
    source: IntegrationSourceId,
    payload: { accountLabel: string; scopes: string[]; tokens: StoredTokens },
  ): Promise<void>;
  remove(source: IntegrationSourceId): Promise<void>;
}

export interface IntegrationServiceDeps {
  connectors: Partial<Record<IntegrationSourceId, Connector>>;
  vault: IntegrationVault;
  getConfig: () => Config;
  setConfig: (config: Config) => void;
  /** Open a URL in the system browser (never an embedded webview). */
  openExternal(url: string): void | Promise<void>;
  cloud?: CloudTokenStore;
  now?: () => number;
}

export interface IntegrationService {
  /** Connection state for every source — metadata only, never tokens. */
  status(): ConnectionStatus[];
  /** Connect: OAuth round-trip (no `token`) or validate a pasted credential. */
  connect(source: IntegrationSourceId, token?: string): Promise<{ ok: boolean; error?: string }>;
  /** Disconnect: best-effort remote revoke + clear the vault + drop metadata. */
  disconnect(source: IntegrationSourceId): Promise<{ ok: boolean; error?: string }>;
  /** **In-process only** — a valid access token for a connected source,
   *  refreshing when expired. Null when disconnected or refresh fails. */
  accessToken(source: IntegrationSourceId): Promise<string | null>;
}

/** Refresh this long before the recorded expiry, so a token never dies mid-call. */
const EXPIRY_SLACK_MS = 60_000;

export function createIntegrationService(deps: IntegrationServiceDeps): IntegrationService {
  const { connectors, vault, getConfig, setConfig } = deps;
  const now = deps.now ?? (() => Date.now());

  /** Last connect/refresh error per source, for the Console's error line. */
  const lastError = new Map<IntegrationSourceId, string>();

  function readTokens(source: IntegrationSourceId): StoredTokens | null {
    const raw = vault.get(SecretName.oauth(source));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredTokens>;
      return typeof parsed.accessToken === 'string' ? (parsed as StoredTokens) : null;
    } catch {
      return null;
    }
  }

  function writeTokens(source: IntegrationSourceId, tokens: StoredTokens): boolean {
    return vault.set(SecretName.oauth(source), JSON.stringify(tokens)).ok;
  }

  /** Replace/remove the source's connection metadata in config (never tokens). */
  function writeMetadata(
    source: IntegrationSourceId,
    meta: { accountLabel: string; scopes: string[] } | null,
  ): void {
    const config = getConfig();
    const others = config.connections.filter((c) => c.source !== source);
    setConfig({
      ...config,
      connections: meta
        ? [...others, { source, ...meta, connectedAt: new Date(now()).toISOString() }]
        : others,
    });
  }

  return {
    status() {
      const connections = getConfig().connections;
      return INTEGRATION_SOURCE_IDS.map((source): ConnectionStatus => {
        const meta = connections.find((c) => c.source === source);
        const connected = readTokens(source) !== null;
        const error = lastError.get(source);
        return {
          source,
          connected,
          ...(connected && meta?.accountLabel ? { account: meta.accountLabel } : {}),
          ...(connected && meta ? { scopes: meta.scopes, connectedAt: meta.connectedAt } : {}),
          oauthReady: connectors[source]?.oauthReady() ?? false,
          ...(error ? { error } : {}),
        };
      });
    },

    async connect(source, token) {
      const connector = connectors[source];
      if (!connector) return { ok: false, error: `Unknown integration: ${source}` };

      const trimmed = token?.trim();
      const outcome = trimmed
        ? await connector.connectToken(trimmed)
        : connector.oauthReady()
          ? await connector.connectOAuth(deps.openExternal)
          : {
              ok: false as const,
              error:
                'OAuth isn’t configured on this machine (set the COCKPITZERO_*_CLIENT_ID/SECRET ' +
                'environment variables) — paste a token instead if this source supports one.',
            };

      if (!outcome.ok || !outcome.tokens) {
        const error = outcome.error ?? 'Connecting failed.';
        lastError.set(source, error);
        return { ok: false, error };
      }
      if (!writeTokens(source, outcome.tokens)) {
        const error = 'Secure storage is unavailable, so the connection can’t be saved.';
        lastError.set(source, error);
        return { ok: false, error };
      }

      const meta = {
        accountLabel: outcome.accountLabel ?? '',
        scopes: outcome.scopes ?? [],
      };
      writeMetadata(source, meta);
      lastError.delete(source);
      // Signed-in mirror (encrypted server-side) — best-effort, never blocks connect.
      void deps.cloud?.push(source, { ...meta, tokens: outcome.tokens }).catch(() => {});
      return { ok: true };
    },

    async disconnect(source) {
      const connector = connectors[source];
      const tokens = readTokens(source);
      if (connector && tokens) {
        try {
          await connector.revoke(tokens);
        } catch {
          /* best-effort — local disconnect proceeds regardless */
        }
      }
      vault.delete(SecretName.oauth(source));
      writeMetadata(source, null);
      lastError.delete(source);
      void deps.cloud?.remove(source).catch(() => {});
      return { ok: true };
    },

    async accessToken(source) {
      const tokens = readTokens(source);
      if (!tokens) return null;
      const expired = tokens.expiresAt !== undefined && tokens.expiresAt - EXPIRY_SLACK_MS <= now();
      if (!expired) return tokens.accessToken;

      const refreshed = await connectors[source]?.refresh(tokens).catch(() => null);
      if (!refreshed) {
        lastError.set(source, 'The connection expired — reconnect it in Console → Integrations.');
        return null;
      }
      writeTokens(source, refreshed);
      return refreshed.accessToken;
    },
  };
}
