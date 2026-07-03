# Production Phase 8 — Cloud memory + knowledge (logged-in)

> **Status:** 🔜 Next · **Depends on:** P5 (local memory engine + ports), P7 (auth + a user id) ·
> **Blocks:** nothing. **Risk:** high — the "best we can in the backend" memory + cross-device sync.

For a **logged-in** user, memory and knowledge become **best-in-class server-side**: a Postgres +
**pgvector** store, cross-device sync of memories, and **document/knowledge ingestion** (folders,
PDFs, pages) into the same semantic index — so recall is richer than any single device's local store.
Free/local users keep their fully-local engine (P5) untouched; this is **opt-in** and only runs when
signed in.

## Goal

When signed in (and memory-sync enabled), the user's memories sync between the local LanceDB store and
a backend pgvector store, recall can draw on the merged set, and the user can ingest documents into a
personal knowledge base that the assistant cites. The same `MemoryService`/`Embedder` ports from P5 are
reused — only the **store adapter** and a **sync layer** are new.

## Locked decisions honored

- Backend swaps **LanceDB → pgvector** behind the P5 ports (same pipeline, different store).
- Everything is **opt-in + signed-in only**; local-first remains the default.

## Scope

**In**

- Backend memory store: `memories` table with a `vector` (pgvector) column + metadata, per `userId`;
  vector + keyword (Postgres FTS) hybrid query mirroring P5's recall.
- Backend embeddings: a server `Embedder` (provider embeddings; consistent dimension with the user's
  data — see Risks). Reuse the extraction pipeline server-side or accept client-extracted facts.
- **Memory sync**: push local memories up + pull remote down (delta by `updatedAt`/id), conflict =
  last-write-wins + dedup on the server. A `memorySync` IPC + backend `/memory` routes.
- **Knowledge ingestion**: ingest documents (start with PDFs + plain text + a folder picker) → chunk →
  embed → store as `knowledge` rows (per user, tagged by source) → recall/cite in `ask`. Reuse the
  Anthropic-skills/PDF-style extraction or a maintained chunker — don't hand-roll a PDF parser.
- Recall fusion across **local + cloud memory + knowledge** when signed in (degrade to local-only when
  offline/signed-out).

**Out**

- Real-time collaborative memory / sharing between users.
- Connector-based knowledge (Slack history, Gmail, Notion) — those arrive with P10's integrations;
  this phase is user-initiated document ingestion + memory sync.

## Packages / infra

```
# Backend
pgvector (Postgres extension) + drizzle-orm/pg-core
# a maintained chunker / text splitter (e.g. from the AI SDK ecosystem or langchain text-splitters)
# a PDF text extractor (reuse the pdf skill's approach / a maintained lib) — do not hand-roll
```

> Move the backend from SQLite → **Postgres** here (pgvector needs it). Keep the Drizzle schema
> Postgres-clean (P7 already aimed for this). Local stays LanceDB.

## Data model & schema changes

- Backend `db/schema.ts` (pg-core): `memories(id, userId, text, kind, importance, embedding vector,
updatedAt, source)` and `knowledge(id, userId, docId, chunk, embedding vector, source, meta,
updatedAt)`; a `documents(id, userId, name, source, status, createdAt)` table for ingest jobs.
- `ai` config gains: `memorySync: z.boolean().default(false)` (opt-in; only meaningful signed-in) and
  reuse `embeddingSource`. Additive defaults.
- Shared wire types for sync payloads (a `MemorySyncRecord[]` mirroring `MemoryEntry`) and ingest
  status — in `packages/shared`.

## IPC channels (desktop)

```ts
memorySyncNow: 'memory:sync',          // push/pull against the backend
knowledgeIngest: 'knowledge:ingest',   // pick files/folder → upload/extract → embed server-side
knowledgeList: 'knowledge:list',
knowledgeRemove: 'knowledge:remove',

// IpcApi
memorySyncNow(): Promise<{ ok: boolean; pushed: number; pulled: number }>;
knowledgeIngest(paths: string[]): Promise<{ ok: boolean; docId: string }>;
knowledgeList(): Promise<Array<{ docId: string; name: string; chunks: number; status: string }>>;
knowledgeRemove(docId: string): Promise<{ ok: boolean }>;
```

## Backend work

- `routes/memory.ts` (auth-gated): `POST /memory/sync` (accept local deltas, upsert+dedup, return
  remote deltas), `GET /memory/search?q=` (server hybrid recall). Validate with shared schemas.
- `routes/knowledge.ts` (auth-gated): upload/ingest (chunk + embed + store), list, remove,
  `GET /knowledge/search`.
- A server embedder + the same dedup/RRF recall logic (factor the pure parts into `packages/shared`
  so local and backend share scoring code — don't duplicate the fusion math).

## Main-process / desktop work

- A cloud `MemoryStore`/recall adapter that, when signed in + `memorySync` on, queries the backend and
  fuses with local results (reuse P5's fusion). Offline ⇒ local-only.
- `sync-service` extension for memory deltas (token from the vault); a knowledge-ingest flow (file
  picker in main, upload to backend).

## Renderer work

- Console "Memory" panel (from P5) gains, when signed in: a "Sync memory across devices" toggle +
  "Sync now" + last-synced; a **Knowledge** sub-view to add documents/folders, see ingest status, and
  remove. Clear messaging that this is cloud + opt-in.

## Acceptance criteria

- [ ] Signed in with sync on, a memory written on device A is recalled on device B after sync.
- [ ] Recall fuses local + cloud + ingested knowledge; signed out/offline degrades cleanly to local.
- [ ] Ingesting a PDF makes its content recallable + citable in `ask` answers (with a source).
- [ ] Memory/knowledge are per-user and auth-gated; nothing syncs for free/local users.
- [ ] Embedding dimensions are consistent (no mixed-dim corruption) — see Risks.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green (backend via `app.request`; pgvector behind a
      test adapter or a flagged integration test).

## Test plan

- `apps/backend/test/memory.test.ts` + `knowledge.test.ts` — seeded session; sync upsert/dedup,
  hybrid search ordering, ingest→search round-trip (with a fake embedder for determinism).
- Shared fusion/scoring unit tests (the pure code shared with P5).
- Desktop sync/ingest service tests with a fake HTTP client + fake vault.

## Risks / open questions

- **Embedding consistency.** Local (transformers.js, 384-dim) vs server (provider, e.g. 1536-dim) must
  not be mixed in one index. Decision: the **server re-embeds** with its own model so the cloud index
  is internally consistent; the local index stays local-dim. Recall fuses _results_, not raw vectors.
- **Privacy + cost.** Syncing memory/knowledge sends user content to our backend — explicit opt-in,
  clear controls, deletion that actually deletes (cascade rows). Ingestion + embedding cost is
  server-side; meter it (ties into P9).
- **Postgres migration.** This phase requires Postgres (pgvector). Sequence the DB swap carefully;
  keep dev able to run (Postgres via Docker, or a managed dev DB).
- **Large documents.** Bound ingest size; chunk + stream; show progress; don't block the launcher.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-8-cloud-memory-knowledge.md` and `CLAUDE.md`, then implement
> cloud memory + knowledge for **signed-in** users (opt-in; free/local stays local). Add a backend
> **Postgres + pgvector** memory store + `knowledge` store reusing the **P5 ports** and shared
> fusion/scoring code; build `/memory/sync` + `/memory/search` + `/knowledge/*` routes (auth-gated).
> Add memory delta sync (local LanceDB ↔ cloud) and document ingestion (PDF/text/folder → chunk →
> embed → recall+cite) using a **maintained chunker + PDF extractor (don't hand-roll)**. Server
> **re-embeds** so the cloud index is dimension-consistent; recall fuses _results_ across local +
> cloud + knowledge, degrading to local when offline. Add Console controls (sync toggle, knowledge
> view) + IPC. Backend tests via `app.request` with a fake embedder; run `pnpm typecheck`,
> `pnpm lint`, `pnpm test`.
