import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type {
  MemorySyncState,
  MemorySyncStatePort,
} from '../../services/sync/memory-sync-service.js';

/**
 * The per-device memory-sync cursor (P8), persisted as a tiny JSON file under
 * `userData` — deliberately NOT in `config.json`, which syncs across devices
 * (each device needs its own `since`). Corrupt/missing file ⇒ a null cursor,
 * which just makes the next sync a full exchange (safe, merely less minimal).
 */

const FILE_NAME = 'memory-sync.json';

export function createMemorySyncStateStore(): MemorySyncStatePort {
  const path = () => join(app.getPath('userData'), FILE_NAME);
  return {
    load(): MemorySyncState {
      try {
        const parsed = JSON.parse(readFileSync(path(), 'utf8')) as { lastSyncedAt?: unknown };
        const at = parsed.lastSyncedAt;
        return { lastSyncedAt: typeof at === 'number' && Number.isFinite(at) ? at : null };
      } catch {
        return { lastSyncedAt: null };
      }
    },
    save(state) {
      try {
        writeFileSync(path(), JSON.stringify(state));
      } catch (err) {
        // Best-effort: a lost cursor only means a fuller next sync.
        console.error('[memory-sync] failed to persist the sync cursor.', err);
      }
    },
  };
}
