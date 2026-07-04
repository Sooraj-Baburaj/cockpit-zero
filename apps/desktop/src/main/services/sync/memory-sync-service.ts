import type { Config, MemorySyncRecord, MemorySyncResponse, MemorySyncResult } from '@cockpitzero/shared';
import type { BackendHttp } from '../auth/auth-service.js';
import type { Embedder } from '../agent/embedder.js';
import type { MemoryStore } from '../agent/memory-service.js';

/**
 * Cloud memory delta sync (production P8) over the backend `/memory/sync` route.
 * Gated twice: it only runs signed-in (vault token) AND with the **opt-in**
 * `ai.memorySync` flag on — free/local users never sync a byte.
 *
 * One `syncNow()` is one exchange: push every local entry changed since this
 * device's cursor (embeddings stripped — the server re-embeds with its own
 * model), then LWW-apply the remote deltas the server returns, **re-embedding
 * each pulled text with the local embedder** so the LanceDB store stays at its
 * own dimension (P8: fuse results, never mix vectors). The cursor (`since`) is
 * per-device state under `userData`, not config — it must not sync.
 */

export interface MemorySyncState {
  lastSyncedAt: number | null;
}

/** Tiny persistence port for the per-device sync cursor (a JSON file in infra). */
export interface MemorySyncStatePort {
  load(): MemorySyncState;
  save(state: MemorySyncState): void;
}

export interface MemorySyncPorts {
  http: BackendHttp;
  /** The vault-held session token, or null when signed out. */
  getToken(): string | null;
  getConfig(): Config;
  store: MemoryStore;
  embedder: Embedder;
  state: MemorySyncStatePort;
}

export interface MemorySyncService {
  /** Signed in AND `ai.memorySync` on — the shared gate for sync + cloud recall. */
  enabled(): boolean;
  /** Push local deltas, pull + apply remote ones. Never throws. */
  syncNow(): Promise<MemorySyncResult>;
  /** Epoch ms of this device's last successful sync, or null. */
  lastSyncedAt(): number | null;
}

/** The wire cap on one push (mirrors `MemorySyncRequestSchema`). */
const PUSH_LIMIT = 1_000;

const NOT_AVAILABLE = 'Sign in and turn on memory sync to sync memories.';

export function createMemorySyncService(ports: MemorySyncPorts): MemorySyncService {
  const enabled = () => ports.getToken() !== null && ports.getConfig().ai.memorySync;

  return {
    enabled,

    lastSyncedAt: () => ports.state.load().lastSyncedAt,

    async syncNow() {
      const token = ports.getToken();
      if (!token || !ports.getConfig().ai.memorySync) {
        return { ok: false, pushed: 0, pulled: 0, error: NOT_AVAILABLE };
      }

      try {
        const since = ports.state.load().lastSyncedAt;
        const all = await ports.store.all();

        // Local deltas since the cursor, oldest first so a capped push sends the
        // backlog in order (the remainder goes next sync). Embeddings never travel.
        const entries: MemorySyncRecord[] = all
          .filter((e) => since === null || e.updatedAt > since)
          .sort((a, b) => a.updatedAt - b.updatedAt)
          .slice(0, PUSH_LIMIT)
          .map(({ embedding: _embedding, ...record }) => record);

        const res = await ports.http.request('/memory/sync', {
          method: 'POST',
          json: { since, entries },
          token,
        });
        if (!res.ok) {
          return { ok: false, pushed: 0, pulled: 0, error: `Memory sync failed (${res.status}).` };
        }
        const body = (await res.json()) as MemorySyncResponse;

        // Apply remote deltas LWW; re-embed locally so the store keeps one dimension.
        const byId = new Map(all.map((e) => [e.id, e]));
        let pulled = 0;
        for (const remote of body.entries) {
          const local = byId.get(remote.id);
          if (local && local.updatedAt >= remote.updatedAt) continue;
          const [embedding] = await ports.embedder.embed([remote.text]);
          await ports.store.upsert({ ...remote, embedding: embedding ?? [] });
          pulled += 1;
        }

        ports.state.save({ lastSyncedAt: body.now });
        return { ok: true, pushed: entries.length, pulled, syncedAt: body.now };
      } catch (err) {
        return {
          ok: false,
          pushed: 0,
          pulled: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
