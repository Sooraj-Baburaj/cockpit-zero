import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { stream } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, streamText } from 'ai';
import {
  AiDigestSummarySchema,
  AiWorkflowPlanSchema,
  INFERENCE_SYSTEM_PROMPTS,
  InferenceRequestSchema,
} from '@cockpitzero/shared';
import type { InferenceRequest, InferenceStreamEvent } from '@cockpitzero/shared';
import { db } from '../db/index.js';
import { usage } from '../db/schema.js';
import { env } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { requireProPlan } from '../middleware/plan.js';
import { cheaperFallback, estimateCost, routeRequest } from '../services/router.js';
import type { RouteDecision } from '../services/router.js';

/**
 * Managed inference (P9): the backend is the AI provider for logged-in pro
 * users. It holds OUR key (server env, never the client), runs the complexity
 * router to pick the model per request, calls the provider via the AI SDK, and
 * meters every request into the `usage` table (billing deferred).
 *
 * Wire shape (see `packages/shared/src/inference.ts`):
 *  - `task: 'ask'`               → NDJSON stream of `InferenceStreamEvent`s
 *    (delta… then done with model/tier/tokens) — proxied end-to-end, never
 *    buffered whole.
 *  - `task: 'workflow'|'digest'` → one JSON `InferenceObjectResponse` whose
 *    `object` fits the task's shared schema (the desktop re-validates).
 *
 * Guards, outermost first: session (`requireAuth`) → plan (`requireProPlan`) →
 * a soft per-user rate cap (in-memory sliding window — an abuse brake, not a
 * quota; hard quotas come with billing). Provider errors retry once on the
 * next-cheaper tier before surfacing a clear error.
 */

/** Sliding-window request timestamps per user (soft rate cap). In-memory is
 *  fine for a single-instance deploy (SHIPPING.md: one Hetzner VPS). */
const requestLog = new Map<string, number[]>();
const WINDOW_MS = 60_000;

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const recent = (requestLog.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= env.INFERENCE_RATE_LIMIT_RPM) {
    throw new HTTPException(429, { message: 'Too many requests — slow down a little.' });
  }
  recent.push(now);
  requestLog.set(userId, recent);
}

/** Token usage as the AI SDK reports it (read defensively). */
interface SdkUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/** Record one metered request. Failures are logged, never surfaced — a meter
 *  hiccup must not fail an answer the user already received. */
async function recordUsage(
  userId: string,
  requestId: string,
  decision: RouteDecision,
  tokens: SdkUsage,
): Promise<void> {
  const inputTokens = tokens.inputTokens ?? 0;
  const outputTokens = tokens.outputTokens ?? 0;
  try {
    await db.insert(usage).values({
      id: randomUUID(),
      userId,
      ts: Date.now(),
      model: decision.model,
      tier: decision.tier,
      inputTokens,
      outputTokens,
      costEstimate: estimateCost(decision.model, inputTokens, outputTokens),
      requestId,
    });
  } catch (err) {
    console.error('[inference] usage write failed', err);
  }
}

/** Build the AI-SDK model for a routing decision, with OUR server-side key. */
function modelFor(decision: RouteDecision) {
  return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(decision.model);
}

/** Object tasks (`workflow` / `digest`): one `generateObject` call, one retry on
 *  the next-cheaper tier if the provider errors, usage metered on success. */
async function runObjectTask(userId: string, requestId: string, body: InferenceRequest) {
  const schema = body.task === 'workflow' ? AiWorkflowPlanSchema : AiDigestSummarySchema;
  let decision = routeRequest(body.task, body.prompt);

  for (;;) {
    try {
      const { object, usage: tokens } = await generateObject({
        model: modelFor(decision),
        schema,
        system: INFERENCE_SYSTEM_PROMPTS[body.task],
        prompt: body.prompt,
      });
      await recordUsage(userId, requestId, decision, tokens);
      return {
        ok: true as const,
        object,
        model: decision.model,
        tier: decision.tier,
        inputTokens: tokens.inputTokens ?? 0,
        outputTokens: tokens.outputTokens ?? 0,
      };
    } catch (err) {
      const fallback = cheaperFallback(decision);
      if (!fallback) throw err;
      console.warn(`[inference] ${decision.model} failed, retrying on ${fallback.model}`, err);
      decision = fallback;
    }
  }
}

export const inference = new Hono()
  .use('*', requireAuth)
  .use('*', requireProPlan)
  .post('/', zValidator('json', InferenceRequestSchema), async (c) => {
    const userId = c.get('userId');
    checkRateLimit(userId);

    if (!env.ANTHROPIC_API_KEY) {
      throw new HTTPException(503, {
        message: 'CockpitZero AI is temporarily unavailable. Please try again later.',
      });
    }

    const body = c.req.valid('json');
    const requestId = c.req.header('x-request-id') ?? randomUUID();

    // Structured tasks return one JSON body — no streaming needed.
    if (body.task !== 'ask') {
      try {
        return c.json(await runObjectTask(userId, requestId, body));
      } catch (err) {
        console.error('[inference] object task failed', err);
        return c.json({ ok: false, error: 'The model call failed. Please try again.' }, 502);
      }
    }

    // `ask` streams NDJSON — each line is one InferenceStreamEvent. The provider
    // stream is forwarded chunk-by-chunk (never buffered whole; the phase-9
    // streaming risk note). A pre-first-token provider failure retries once on
    // the next-cheaper tier; a mid-stream failure surfaces an error event.
    c.header('Content-Type', 'application/x-ndjson; charset=utf-8');
    return stream(c, async (out) => {
      const write = (event: InferenceStreamEvent) => out.write(`${JSON.stringify(event)}\n`);
      let decision = routeRequest(body.task, body.prompt);

      for (;;) {
        let streamedAny = false;
        try {
          const result = streamText({
            model: modelFor(decision),
            system: INFERENCE_SYSTEM_PROMPTS.ask,
            prompt: body.prompt,
            abortSignal: c.req.raw.signal,
          });
          for await (const delta of result.textStream) {
            streamedAny = true;
            await write({ type: 'delta', text: delta });
          }
          const tokens = await result.usage;
          await recordUsage(userId, requestId, decision, tokens);
          await write({
            type: 'done',
            model: decision.model,
            tier: decision.tier,
            inputTokens: tokens.inputTokens ?? 0,
            outputTokens: tokens.outputTokens ?? 0,
          });
          return;
        } catch (err) {
          // Client hung up (Escape / closed the bar) — nothing to say to anyone.
          if (c.req.raw.signal.aborted) return;
          const fallback = streamedAny ? null : cheaperFallback(decision);
          if (fallback) {
            console.warn(`[inference] ${decision.model} failed, retrying on ${fallback.model}`);
            decision = fallback;
            continue;
          }
          console.error('[inference] stream failed', err);
          await write({ type: 'error', message: 'The model call failed. Please try again.' });
          return;
        }
      }
    });
  });
