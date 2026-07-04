import {
  AiDigestSummarySchema,
  AiWorkflowPlanSchema,
  buildDigestPrompt,
  coerceDigestRankings,
  planToWorkflowDraft,
  rankDigestItems,
} from '@cockpitzero/shared';
import type {
  AiAnswer,
  InferenceObjectResponse,
  InferenceStreamEvent,
  InferenceTask,
  Plan,
  WorkflowDraft,
} from '@cockpitzero/shared';
import type { AiProvider } from '../../services/ai/provider.js';
import type { BackendHttp } from '../../services/auth/auth-service.js';

/**
 * The `managed` provider (production phase 9) — CockpitZero-hosted inference for
 * logged-in pro users. Implements the P3 `AiProvider` port by calling the
 * backend `/inference` endpoint with the vault session token: **no key on the
 * client, no model picking on the client** — the backend's complexity router
 * selects the model per request and streams the answer back (NDJSON), metering
 * usage as it goes. Dependency-inverted like every other adapter: HTTP, the
 * token, and the last-known plan are injected, so it's testable with fakes.
 */

/** Streams can run long — give them their own generous time-box (the per-chunk
 *  progress keeps the connection alive; this is the hard ceiling). */
const STREAM_TIMEOUT_MS = 120_000;
const OBJECT_TIMEOUT_MS = 60_000;

export interface ManagedProviderDeps {
  http: BackendHttp;
  /** The vault-held session token, or null when signed out. */
  getToken(): string | null;
  /** The last-known plan (cached by the auth service's whoami). Null = unknown —
   *  treated optimistically as eligible; the backend is the real gate. */
  getPlan(): Plan | null;
}

/** Human message for a gated/non-OK `/inference` response. */
async function requestError(res: Response): Promise<Error> {
  if (res.status === 401) return new Error('Sign in (Console → Account) to use CockpitZero AI.');
  if (res.status === 403) return new Error('CockpitZero AI requires the Pro plan.');
  if (res.status === 429) return new Error('You’re asking very fast — give it a few seconds.');
  if (res.status === 503) return new Error('CockpitZero AI is temporarily unavailable.');
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return new Error(body.error ?? body.message ?? `CockpitZero AI failed (${res.status}).`);
  } catch {
    return new Error(`CockpitZero AI failed (${res.status}).`);
  }
}

/** Provenance line: `cockpit-ai · CockpitZero AI · auto (claude-sonnet-5) · 1.2s · 412 tok`. */
function buildMeta(startedAt: number, model?: string, tokens?: number): string {
  const latency = ((Date.now() - startedAt) / 1000).toFixed(1);
  const parts = ['cockpit-ai', 'CockpitZero AI', `auto${model ? ` (${model})` : ''}`, `${latency}s`];
  if (tokens && tokens > 0) parts.push(`${tokens} tok`);
  return parts.join(' · ');
}

export function createManagedProvider(deps: ManagedProviderDeps): AiProvider {
  /** POST one inference request; throws a friendly error on any non-OK status. */
  async function post(
    task: InferenceTask,
    prompt: string,
    opts: { timeoutMs: number; signal?: AbortSignal },
  ): Promise<Response> {
    const token = deps.getToken();
    if (!token) throw new Error('Sign in (Console → Account) to use CockpitZero AI.');
    const res = await deps.http.request('/inference', {
      method: 'POST',
      json: { task, prompt },
      token,
      timeoutMs: opts.timeoutMs,
      signal: opts.signal,
    });
    if (!res.ok) throw await requestError(res);
    return res;
  }

  /** Consume the NDJSON `ask` stream, forwarding deltas; resolves the answer. */
  async function streamAsk(
    prompt: string,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<AiAnswer> {
    const startedAt = Date.now();
    const res = await post('ask', prompt, { timeoutMs: STREAM_TIMEOUT_MS, signal });
    if (!res.body) throw new Error('CockpitZero AI returned an empty stream.');

    const decoder = new TextDecoder();
    let pending = '';
    let text = '';
    let done: Extract<InferenceStreamEvent, { type: 'done' }> | undefined;

    const handleLine = (line: string) => {
      if (line.trim() === '') return;
      const event = JSON.parse(line) as InferenceStreamEvent;
      if (event.type === 'delta') {
        text += event.text;
        onDelta(event.text);
      } else if (event.type === 'done') {
        done = event;
      } else {
        throw new Error(event.message);
      }
    };

    // res.body is a web ReadableStream (Node 22 fetch) — async-iterate chunks,
    // split on newlines (one JSON event per line), keep the partial tail.
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    }
    if (pending.trim() !== '') handleLine(pending);

    const tokens = done ? done.inputTokens + done.outputTokens : 0;
    return {
      text: text.trim(),
      meta: buildMeta(startedAt, done?.model, tokens),
      suggestions: [],
    };
  }

  /** Run an object task and re-validate the wire payload (never trust it raw). */
  async function objectTask(task: Exclude<InferenceTask, 'ask'>, prompt: string): Promise<unknown> {
    const res = await post(task, prompt, { timeoutMs: OBJECT_TIMEOUT_MS });
    const body = (await res.json()) as InferenceObjectResponse;
    if (!body.ok || body.object === undefined) {
      throw new Error(body.error ?? 'CockpitZero AI could not complete the request.');
    }
    return body.object;
  }

  return {
    id: 'managed',

    // Signed in and not known-free. Plan is the backend's call — the cached
    // read only exists so a known-free user gets the connect-nudge instead of
    // a 403; unknown (null, e.g. before the first whoami) stays optimistic.
    ready: () => deps.getToken() !== null && deps.getPlan() !== 'free',

    async ask(prompt) {
      return streamAsk(prompt, () => {});
    },

    async askStream(prompt, _ctx, onDelta, signal) {
      return streamAsk(prompt, onDelta, signal);
    },

    async draftWorkflow(description): Promise<WorkflowDraft> {
      const object = await objectTask('workflow', `Draft a workflow for this request:\n\n${description}`);
      return planToWorkflowDraft(AiWorkflowPlanSchema.parse(object));
    },

    async summarizeDigest(items, opts) {
      // Digests must always render — any managed failure falls back to the
      // deterministic local ranker (same policy as the BYOP adapter).
      try {
        const object = await objectTask('digest', buildDigestPrompt(items, opts));
        return coerceDigestRankings(AiDigestSummarySchema.parse(object), items, opts);
      } catch {
        return rankDigestItems(items, opts);
      }
    },
  };
}
