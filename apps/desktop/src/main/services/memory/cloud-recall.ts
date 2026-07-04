import { fuseRankedLists } from '@cockpitzero/shared';
import type { Config, KnowledgeHit, MemorySyncRecord } from '@cockpitzero/shared';
import type { BackendHttp } from '../auth/auth-service.js';
import type { MemoryEntry, MemoryService } from '../agent/memory-service.js';

/**
 * Cloud recall fusion (production P8): a decorator over the local `MemoryService`
 * that, when the user is signed in AND opted into `ai.memorySync`, also queries
 * the backend — cloud memories (`/memory/search`) and ingested knowledge
 * (`/knowledge/search`) — and fuses the three ranked lists (shared
 * `fuseRankedLists`, dedup by id so a synced memory isn't counted twice).
 *
 * Every failure path degrades to **local-only**: signed out, sync off, offline,
 * a slow/erroring backend — recall never breaks because the cloud did (the
 * per-request time-box lives in the backend client). Knowledge hits surface as
 * `kind: 'knowledge'` entries whose `source` is the document name, which the ask
 * path renders as a citation. Everything except `recall` passes straight through
 * — Console management (stats/search/forget/clear) stays a local view.
 */

export interface CloudRecallPorts {
  http: BackendHttp;
  /** The vault-held session token, or null when signed out. */
  getToken(): string | null;
  getConfig(): Config;
}

const DEFAULT_LIMIT = 5;

export function withCloudRecall(local: MemoryService, ports: CloudRecallPorts): MemoryService {
  /** Time-boxed, throw-free GET — any failure means "no cloud results". */
  async function fetchJson<T>(path: string, token: string): Promise<T | null> {
    try {
      const res = await ports.http.request(path, { token });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  return {
    ...local,

    async recall(query, limit = DEFAULT_LIMIT) {
      const localHits = await local.recall(query, limit);
      const token = ports.getToken();
      if (!token || !ports.getConfig().ai.memorySync || !local.enabled()) return localHits;

      const params = `q=${encodeURIComponent(query)}&limit=${limit}`;
      const [cloud, knowledge] = await Promise.all([
        fetchJson<{ entries: MemorySyncRecord[] }>(`/memory/search?${params}`, token),
        fetchJson<{ hits: KnowledgeHit[] }>(`/knowledge/search?${params}`, token),
      ]);

      // Results-only fusion: cloud entries carry no local-dimension embedding.
      const cloudEntries: MemoryEntry[] = (cloud?.entries ?? []).map((e) => ({
        ...e,
        embedding: [],
      }));
      const knowledgeEntries: MemoryEntry[] = (knowledge?.hits ?? []).map((h, i) => ({
        id: `kn_${h.docId}_${i}`,
        ts: 0,
        updatedAt: 0,
        kind: 'knowledge',
        text: h.chunk,
        importance: 0.5,
        source: h.docName,
        embedding: [],
      }));
      if (cloudEntries.length === 0 && knowledgeEntries.length === 0) return localHits;

      return fuseRankedLists([localHits, cloudEntries, knowledgeEntries], (e) => e.id, limit);
    },
  };
}
