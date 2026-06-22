import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MemoryEntry, MemoryStore } from '../../services/agent/memory-service.js';

/**
 * The on-disk memory store (Phase 7) — a small JSON file in the OS app-data dir,
 * deliberately **outside** the synced `config.json` (memory is local + private;
 * cross-device sync is a separate backend effort). This is the infra adapter: the
 * only `electron`/`fs` touch behind the pure `MemoryService`.
 *
 * | macOS   | ~/Library/Application Support/CockpitZero/memory.json |
 * | Windows | %APPDATA%/CockpitZero/memory.json                     |
 * | Linux   | ~/.config/CockpitZero/memory.json                     |
 *
 * The path is resolved **lazily** (on first read/write) — the singleton may be
 * constructed at import time, before `app` is ready, and `app.getPath` needs a
 * ready app. A corrupt/missing file degrades to an empty store (never throws).
 */

interface MemoryFile {
  version: 1;
  entries: MemoryEntry[];
}

export function createFileMemoryStore(): MemoryStore {
  let cache: MemoryEntry[] | null = null;
  let filePath: string | null = null;

  const path = () => (filePath ??= join(app.getPath('userData'), 'memory.json'));

  function load(): MemoryEntry[] {
    if (cache) return cache;
    try {
      if (!existsSync(path())) return (cache = []);
      const raw = JSON.parse(readFileSync(path(), 'utf8')) as Partial<MemoryFile>;
      cache = Array.isArray(raw.entries) ? raw.entries : [];
    } catch {
      cache = [];
    }
    return cache;
  }

  return {
    all() {
      return load();
    },
    append(entry) {
      const entries = [...load(), entry];
      cache = entries;
      try {
        const file: MemoryFile = { version: 1, entries };
        writeFileSync(path(), JSON.stringify(file, null, 2));
      } catch {
        // A failed write keeps the in-memory cache so the run still works; the
        // entry is simply not persisted (e.g. a read-only disk).
      }
    },
  };
}
