# Production Phase 5 — Local memory engine (LanceDB + embeddings + extraction)

> **Status:** 🔜 Next · **Depends on:** P3 (provider for extraction; embeddings can be keyless) ·
> **Blocks:** P6 (agent recall), P8 (cloud sync mirrors this). **Risk:** high — native module +
> the "best-in-the-world memory" mandate. This is the centerpiece.

The v1 memory is a JSON file with **keyword-overlap** recall and an unused `embedding` field. Replace
it with a real, local-first **memory engine**: durable-fact **extraction**, on-device **embeddings**,
a **LanceDB** vector store, and **hybrid recall** (semantic + keyword + recency), with **dedup /
update / decay**. All on-device, **no login, no key required** for the baseline (local ONNX
embeddings); better extraction when a provider key is present.

## Goal

The assistant accumulates _meaningful_ memories (not raw transcripts) and recalls the most relevant
ones for any prompt via semantic search fused with keyword + recency — entirely on the user's machine.
`MemoryService.recall(query)` returns markedly better hits than keyword overlap; `ask` (P3) injects
recalled context. Everything stays gated by `ai.memoryEnabled`.

## Locked decisions honored

- **Native TS pipeline** (we own extract→embed→dedup→recall).
- **LanceDB** embedded vector store (`@lancedb/lancedb`), on-disk under `userData`.
- **transformers.js** (`@huggingface/transformers`) ONNX embeddings on-device (no key/offline) by
  default; **provider embeddings** (AI SDK `embed`/`embedMany`) when a key exists (higher quality,
  user-opt-in). Backend (P8) swaps LanceDB→pgvector behind the same ports.

## Scope

**In**

- Keep the `MemoryService` **port** shape (`enabled`/`write`/`recall`) so P6/Phase-7 callers don't
  change, but swap the implementation to the new engine and add `remember(text)` (extraction entry)
  - `forget(id)`.
- `infra/agent/lance-memory-store.ts` — LanceDB-backed `MemoryStore` (vectors + metadata + text),
  replacing `infra/agent/memory-store.ts` (JSON). One-time **migration** of an existing `memory.json`
  into LanceDB on first run.
- `infra/agent/embedder.ts` — `Embedder` port + a transformers.js adapter (lazy model load, cached
  under `userData/models`) and an AI-SDK adapter (when a provider key is set).
- `services/agent/extractor.ts` — turns raw conversation/turns into **atomic, durable facts** using
  the provider (`generateObject`: array of `{ text, kind, importance }`); a keyless heuristic fallback
  (sentence/entity chunking) when offline.
- Hybrid **recall**: vector top-k + keyword (the existing term overlap) + recency, fused with
  Reciprocal Rank Fusion; return diversified top-N.
- **Dedup / update / decay**: near-duplicate detection by cosine similarity → merge/update instead of
  append; an importance + recency score so stale low-value memories rank down (optional periodic prune).
- Wire `recall` into P3's `ask` so answers are context-aware; persist the answer/useful turns to memory
  on completion (the P4 `done` hook is the natural place).
- A Console "Memory" view: count, last-updated, search box, and per-entry delete ("forget") + a global
  "clear memory" — all local.

**Out**

- Cloud sync of memory (P8).
- Document/knowledge-base ingestion (PDFs, folders) — P8 "knowledge"; this phase is conversational
  memory. (You may stub the `Embedder`/store so P8 can reuse them for documents.)

## Packages to add (catalog them)

```
@lancedb/lancedb            # embedded vector DB (native module — main process only)
@huggingface/transformers   # transformers.js v3, ONNX local embeddings (main process)
```

> **Native-module gotchas (important):**
>
> - Both run in the **main process only** — never import in the renderer.
> - Mark them `external` in `electron.vite.config.ts` (main build) so electron-vite doesn't try to
>   bundle the native `.node` binaries.
> - LanceDB ships prebuilt binaries per platform/arch — ensure electron-builder packages the right
>   one; add an Electron ABI rebuild step if needed.
> - transformers.js downloads model weights on first use — bundle a small default model
>   (`Xenova/all-MiniLM-L6-v2`, 384-dim, or `Xenova/bge-small-en-v1.5`) or fetch+cache under
>   `userData/models` with a clear first-run "preparing local AI" state. Make it **offline-capable**
>   after the first download.

## Data model & schema changes

- `ai` config gains memory knobs (additive defaults, version stays 1):

```ts
// inside AiSettingsSchema
memoryEnabled: z.boolean().default(true),
/** Where embeddings come from. `local` = on-device ONNX (no key); `provider` = the
 *  configured AI provider's embedding model (better, needs a key). */
embeddingSource: z.enum(['local', 'provider']).default('local'),
```

- `MemoryEntry` (in `services/agent/memory-service.ts`) gains real fields: `embedding: number[]`
  (now used), `importance: number`, `updatedAt: number`, `source?: string`. The LanceDB row mirrors
  it. (Keep `MemoryEntry` here, not in `config` — memory is not synced config.)
- The store moves from `userData/memory.json` to `userData/memory.lance/` (a LanceDB dataset dir).

## IPC channels

```ts
// IpcChannels
memoryStats: 'memory:stats',
memorySearch: 'memory:search',
memoryForget: 'memory:forget',
memoryClear: 'memory:clear',

// IpcApi
memoryStats(): Promise<{ count: number; updatedAt: number | null; embeddingSource: string }>;
memorySearch(query: string): Promise<MemoryEntry[]>;   // for the Console memory view
memoryForget(id: string): Promise<{ ok: boolean }>;
memoryClear(): Promise<{ ok: boolean }>;
```

(`recall`/`write` stay **internal** to the agent/ask path — not new IPC; they're called server-side.)

## Main-process work

- `Embedder` port: `embed(texts: string[]): Promise<number[][]>` + `dimensions`. Adapters:
  transformers.js (mean-pooled, normalized) and AI-SDK (`embedMany`). Selected by
  `ai.embeddingSource` (+ availability of a key).
- `lance-memory-store.ts`: open/create the dataset, `append`/`upsert` rows (vector + metadata + text),
  `vectorSearch(queryVec, k)`, `all()`, `delete(id)`, `clear()`. Lazy path resolution + degrade to an
  empty in-memory set if LanceDB fails to load (never crash the launcher).
- Rewrite `memory-service.ts` engine:
  - `remember(rawText)` → `extractor` → for each fact: embed → dedup-check (cosine ≥ threshold against
    nearest) → upsert or insert.
  - `recall(query, limit)` → embed query → vector top-k ∪ keyword matches → RRF fuse with a recency +
    importance boost → top-N. `[]` when `memoryEnabled` is false.
- `extractor.ts`: `generateObject` with a schema of `{ facts: {text, kind, importance}[] }`; keyless
  fallback splits into candidate facts heuristically. Validate output.
- Migration: on first run, if `memory.json` exists, embed + import its entries into LanceDB, then
  rename the old file to `memory.json.migrated`.
- Wire `recall` into `ai-service.ask`/`askStream`: prepend a compact "Relevant memory" context block
  to the prompt (cap tokens); after a successful answer, `remember` the salient exchange.

## Renderer work

- Console "Memory" panel (new tab or within the AI tab): stats, a search box (`memorySearch`), a list
  of entries with delete, and "Clear all memory" (confirm). Sahara styling; keyboard-first.
- Dev mock `window.api`: in-memory implementations of the four memory channels.

## Acceptance criteria

- [ ] With memory on and no key, embeddings run **locally** (offline after first model fetch) and
      semantic recall returns relevant entries that keyword overlap would miss (e.g. "deck" recalls a
      memory phrased "presentation").
- [ ] Writing two near-identical facts results in **one** merged/updated entry, not two.
- [ ] `recall` fuses semantic + keyword + recency (a unit test proves a recency tiebreak and a
      semantic-only hit both surface).
- [ ] `ask` answers reflect injected memory context; the salient exchange is remembered afterward.
- [ ] An existing `memory.json` is migrated into LanceDB on first run; memory never lands in
      `config.json`.
- [ ] Memory is fully gated by `ai.memoryEnabled` (off ⇒ no writes, empty recall) and the Console can
      search/forget/clear.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green (LanceDB/transformers faked in tests).

## Test plan

- `test/memory-service.test.ts` — rewrite with a fake `MemoryStore` + fake `Embedder`: dedup/update,
  RRF fusion ordering, recency/importance boosts, `enabled` gating, `forget`/`clear`.
- `test/extractor.test.ts` — fake provider returns facts; keyless fallback splits text; output is
  validated.
- Keep all tests electron-free and network-free (no real LanceDB/transformers in unit tests; test the
  adapters behind their ports with fakes, and do one optional integration test behind a flag).

## Risks / open questions

- **Native module packaging** (LanceDB ABI per platform, model download size) — the biggest risk.
  Prove `electron-builder` ships a working binary on macOS + Windows early; budget the first-run model
  download UX.
- **Extraction quality vs cost.** Extraction is an LLM call — batch it (don't extract per token);
  consider extracting on session end / idle, not every turn. Keyless fallback must be acceptable.
- **Embedding dim mismatch** if the user switches `embeddingSource`. Decision: re-embed on source
  change, or pin the dataset to its creation-time embedder + dim and require a clear "rebuild memory"
  action to switch.
- **Privacy.** Memory is local + private; surface a clear control to view/clear it. Nothing leaves the
  machine until P8 (logged-in, opt-in).

---

### Kickoff prompt

> Read `docs/roadmap/phase-5-local-memory-engine.md` and `CLAUDE.md`, then implement the
> local memory engine. Replace the JSON keyword store with a **native TS pipeline**: durable-fact
> **extraction** (AI-SDK `generateObject`, keyless heuristic fallback), on-device **embeddings**
> (`@huggingface/transformers` ONNX, no key/offline; AI-SDK embeddings when a key is set), a
> **LanceDB** (`@lancedb/lancedb`) vector store under `userData`, and **hybrid recall** (semantic +
> keyword + recency via RRF) with **dedup/update/decay**. Keep the `MemoryService` port; migrate any
> existing `memory.json` into LanceDB. Wire `recall` into `ask` and remember salient exchanges. Add a
> Console memory view (stats/search/forget/clear) + IPC. Native modules are **main-process only**,
> `external` in the vite config — never the renderer. Gate everything on `ai.memoryEnabled`. Test with
> faked store/embedder (no network); run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
