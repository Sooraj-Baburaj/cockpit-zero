import { safeValidateConfig } from '@cockpitzero/shared';
import type { Config } from '@cockpitzero/shared';
import type { BackendHttp } from '../auth/auth-service.js';

/**
 * Cross-device config sync (production P7) over the backend `/sync` routes.
 * Push sends the current local Config (the backend validates against
 * ConfigSchema and upserts, last-write-wins); pull returns the cloud copy for
 * the renderer to apply via the normal `setConfig` path — this service never
 * writes config itself. Ports are injected so tests run with fakes.
 */

export interface SyncPorts {
  http: BackendHttp;
  /** The vault-held session token, or null when signed out. */
  getToken(): string | null;
  /** The current local config (config-service). */
  getConfig(): Config;
}

export interface SyncService {
  push(): Promise<{ ok: boolean; syncedAt?: string; error?: string }>;
  pull(): Promise<{ ok: boolean; config: Config | null; error?: string }>;
}

const NOT_SIGNED_IN = 'Sign in to sync your config.';

export function createSyncService(ports: SyncPorts): SyncService {
  return {
    async push() {
      const token = ports.getToken();
      if (!token) return { ok: false, error: NOT_SIGNED_IN };
      try {
        const res = await ports.http.request('/sync', {
          method: 'POST',
          json: ports.getConfig(),
          token,
        });
        if (!res.ok) {
          return { ok: false, error: `Sync failed (${res.status}).` };
        }
        const body = (await res.json()) as { syncedAt?: string };
        return { ok: true, syncedAt: body.syncedAt };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async pull() {
      const token = ports.getToken();
      if (!token) return { ok: false, config: null, error: NOT_SIGNED_IN };
      try {
        const res = await ports.http.request('/sync', { token });
        if (!res.ok) {
          return { ok: false, config: null, error: `Sync failed (${res.status}).` };
        }
        const body = (await res.json()) as { config: unknown };
        if (body.config === null || body.config === undefined) {
          return { ok: true, config: null };
        }
        // Never hand the renderer an unvalidated blob — a bad cloud payload
        // must not be able to corrupt the local config.
        const parsed = safeValidateConfig(body.config);
        if (!parsed.success) {
          return { ok: false, config: null, error: 'The cloud config is invalid.' };
        }
        return { ok: true, config: parsed.data };
      } catch (err) {
        return { ok: false, config: null, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
