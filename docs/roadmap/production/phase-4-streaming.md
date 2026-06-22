# Production Phase 4 — Streaming end-to-end

> **Status:** 🔜 Next · **Depends on:** P3 (real providers) · **Blocks:** nothing (polish, but high
> perceived value). **Risk:** medium — adds a push IPC path + renderer incremental rendering.

Phase 1 (v1) deliberately chose **resolve-once** for `askAI`. With real providers (P3) the mockups'
typing-caret reveal should be real token streaming. The task surface (v1 Phase 7) already streams
snapshots over a push channel (`task:update` / `onTaskUpdate`) — reuse that exact pattern for `ask`.

## Goal

`askAI` streams tokens to the launcher/Console as they arrive (visible incremental text + a live
"thinking" state), using the Vercel AI SDK's `streamText`. The resolve-once `askAI` stays as a
fallback/compat path.

## Scope

**In**

- A streaming ask channel using the established **push** pattern: a renderer-invoked
  `askAIStream(prompt)` that returns a `streamId`, with chunks pushed via `webContents.send` and a
  preload `onAiStream` listener (mirrors `onTaskUpdate`).
- `infra/ai/sdk-provider.ts` gains `askStream(prompt, ctx, onChunk)` using `streamText`'s
  `textStream`/`fullStream`; emits token deltas, then a final `AiAnswer` (with `meta` + suggestions).
- Renderer: the launcher AI answer panel + Console composer render incremental text; a final event
  swaps in the parsed suggestions.
- Cancellation: a `cancelAiStream(streamId)` that aborts the SDK request (AbortController).

**Out**

- Streaming structured output for `draftWorkflow`/`summarizeDigest` (those stay resolve-once;
  `generateObject` isn't a token-stream UX). Only the free-text `ask` streams.
- Tool-call streaming inside the agent (P6 owns that; it already streams step snapshots).

## Data model & schema changes

None in config. Add wire types in `shared/types.ts`:

```ts
export type AiStreamEvent =
  | { streamId: string; type: 'delta'; text: string }
  | { streamId: string; type: 'done'; answer: AiAnswer }
  | { streamId: string; type: 'error'; message: string };
```

## IPC channels

Follow the **push** recipe used by `onTaskUpdate` (the only other `ipcRenderer.on`):

```ts
// IpcChannels
askAIStream: 'ai:ask-stream',
cancelAiStream: 'ai:ask-cancel',
AI_STREAM_CHANNEL: 'ai:stream',   // main → renderer push (like TASK_UPDATE_CHANNEL)

// IpcApi
/** Start a streamed answer; resolves with the streamId. Chunks arrive via onAiStream. */
askAIStream(prompt: string): Promise<{ streamId: string }>;
cancelAiStream(streamId: string): Promise<void>;
/** Subscribe to stream events; returns an unsubscribe fn (registered in preload). */
onAiStream(cb: (e: AiStreamEvent) => void): () => void;
```

Preload registers exactly one `ipcRenderer.on(AI_STREAM_CHANNEL, …)` (alongside the task one) and
exposes `onAiStream`. **Don't** add ad-hoc `ipcRenderer.on` elsewhere (CLAUDE.md gotcha).

## Main-process work

- `sdk-provider.ts`: `askStream` runs `streamText({ model, prompt, abortSignal })`; for each delta
  call `onChunk`; on finish assemble the `AiAnswer` (text + usage `meta` + any suggestions parsed
  post-hoc) and emit `done`.
- `ipc/index.ts`: `askAIStream` generates a `streamId`, kicks off the stream, forwards events to
  `event.sender.send(AI_STREAM_CHANNEL, …)`; track AbortControllers by `streamId` for `cancelAiStream`.
- `ai-service.ts`: add `askStream` to the service; when `provider==='mock'` emit a few canned deltas
  then `done` (so tests + the no-key state still animate).

## Renderer work

- Extend the shared AI reducer (`aiPhaseReducer`) used by both the launcher and the Console composer
  to handle `delta`/`done`/`error` (append text on delta; finalize on done). Show a caret/cursor while
  streaming; render suggestions only on `done`.
- `useLauncherSearch`/the ask hook: call `askAIStream`, subscribe via `onAiStream`, unsubscribe +
  `cancelAiStream` on unmount/escape.
- Keep the non-stream `askAI` for any caller that wants a single value (e.g. tests, digest preview).

## Acceptance criteria

- [ ] Asking from the bar shows text appearing incrementally, then suggested actions on completion.
- [ ] Pressing Escape / closing the bar aborts the in-flight request (provider call actually cancels).
- [ ] The `mock` provider streams canned deltas so dev/CI animate without a key.
- [ ] Exactly one new `ipcRenderer.on` (in preload) was added; no raw IPC in components.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `test/ai-service.test.ts`: `askStream` with a fake provider emits ordered delta…done; abort stops
  emission.
- Contract test for the new channels.
- A reducer unit test (in renderer test scope or shared) for delta accumulation + done finalization.

## Risks / open questions

- **Backpressure / chunk spam.** Coalesce deltas (e.g. flush every animation frame or ~30ms) so we
  don't flood the bridge with one IPC message per token.
- **Suggestions from a stream.** Suggested actions are easiest to compute at the end; stream prose,
  attach suggestions on `done`. If we later want streamed structured output, revisit with the SDK's
  `streamObject`.
- **Memory of the answer.** When P5 lands, persist the final answer to memory on `done` (not per
  delta).

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-4-streaming.md` and `CLAUDE.md`, then implement token streaming
> for `askAI`. Use the Vercel AI SDK `streamText` in `sdk-provider.ts`, and the **push IPC pattern**
> already used by `onTaskUpdate` (one new `ipcRenderer.on` in preload — `onAiStream`). Add
> `askAIStream`/`cancelAiStream` channels + an `AI_STREAM_CHANNEL`, stream deltas, finalize with the
> full `AiAnswer` (+ suggestions on done), and support abort on Escape. Keep the resolve-once `askAI`
> and make the `mock` provider emit canned deltas for CI. Coalesce deltas to avoid bridge spam. Add
> tests; run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
