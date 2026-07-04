import type { KnowledgeDoc, KnowledgeSourceType } from '@cockpitzero/shared';
import type { BackendHttp } from '../auth/auth-service.js';

/**
 * Desktop side of knowledge ingestion (production P8). The heavy lifting —
 * extraction, chunking, embedding — is **server-side**; this service just picks
 * files (native dialog, main process), reads + base64s them (bounded), and talks
 * to the auth-gated `/knowledge` routes. Signed-in only; every result is an
 * `{ ok, error? }` shape the Console can render directly. Ports are injected so
 * tests run with fakes (no `electron`, no fs, no network).
 */

/** One document ready to upload (already read + encoded by the loader port). */
export interface KnowledgeUpload {
  name: string;
  type: KnowledgeSourceType;
  /** Base64 file bytes. */
  content: string;
}

export interface KnowledgePorts {
  http: BackendHttp;
  /** The vault-held session token, or null when signed out. */
  getToken(): string | null;
  /** Open the native picker; resolves absolute paths ([] = cancelled). */
  pickPaths(): Promise<string[]>;
  /** Expand folders, filter to supported documents, read + encode each (bounded).
   *  `skipped` names anything left out (unsupported type / too large). */
  loadFiles(paths: string[]): Promise<{ uploads: KnowledgeUpload[]; skipped: string[] }>;
}

export interface KnowledgeService {
  /** Ingest documents by path; empty `paths` opens the picker. */
  ingest(paths: string[]): Promise<{ ok: boolean; docIds: string[]; error?: string }>;
  list(): Promise<{ ok: boolean; docs: KnowledgeDoc[]; error?: string }>;
  remove(docId: string): Promise<{ ok: boolean; error?: string }>;
}

const NOT_SIGNED_IN = 'Sign in to add documents to your cloud knowledge.';

/** Uploads can be big and the server chunks + embeds inline — allow well past
 *  the default 15s request time-box. */
const INGEST_TIMEOUT_MS = 120_000;

export function createKnowledgeService(ports: KnowledgePorts): KnowledgeService {
  return {
    async ingest(paths) {
      const token = ports.getToken();
      if (!token) return { ok: false, docIds: [], error: NOT_SIGNED_IN };

      try {
        const picked = paths.length > 0 ? paths : await ports.pickPaths();
        if (picked.length === 0) return { ok: true, docIds: [] }; // picker cancelled

        const { uploads, skipped } = await ports.loadFiles(picked);
        if (uploads.length === 0) {
          return { ok: false, docIds: [], error: 'No supported documents (PDF, text) selected.' };
        }

        const docIds: string[] = [];
        const failed: string[] = [];
        // Sequential so one slow/huge document can't fan out N parallel uploads.
        for (const upload of uploads) {
          const res = await ports.http.request('/knowledge', {
            method: 'POST',
            json: upload,
            token,
            timeoutMs: INGEST_TIMEOUT_MS,
          });
          const body = (await res.json().catch(() => ({}))) as { ok?: boolean; docId?: string };
          if (res.ok && body.ok && body.docId) docIds.push(body.docId);
          else failed.push(upload.name);
        }

        const problems = [...failed, ...skipped];
        return {
          ok: docIds.length > 0,
          docIds,
          error: problems.length > 0 ? `Couldn’t ingest: ${problems.join(', ')}.` : undefined,
        };
      } catch (err) {
        return {
          ok: false,
          docIds: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async list() {
      const token = ports.getToken();
      if (!token) return { ok: false, docs: [], error: NOT_SIGNED_IN };
      try {
        const res = await ports.http.request('/knowledge', { token });
        if (!res.ok) return { ok: false, docs: [], error: `Couldn’t load knowledge (${res.status}).` };
        const body = (await res.json()) as { docs: KnowledgeDoc[] };
        return { ok: true, docs: body.docs };
      } catch (err) {
        return { ok: false, docs: [], error: err instanceof Error ? err.message : String(err) };
      }
    },

    async remove(docId) {
      const token = ports.getToken();
      if (!token) return { ok: false, error: NOT_SIGNED_IN };
      try {
        const res = await ports.http.request(`/knowledge/${encodeURIComponent(docId)}`, {
          method: 'DELETE',
          token,
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
        return { ok: res.ok && body.ok === true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
