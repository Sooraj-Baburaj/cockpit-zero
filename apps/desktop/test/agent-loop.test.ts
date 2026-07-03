import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { generateText } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { createAgentLoop, type LoopTool } from '../src/main/services/agent/agent-loop.js';

/**
 * The agent loop is dependency-inverted (model resolver + AI-SDK entry injected), so
 * here we prove the **wiring** two ways without a network: (1) with the `generate`
 * seam faked, asserting the loop maps `LoopTool`s → an AI-SDK toolset and folds the
 * intent + memory into the prompt; and (2) end-to-end through the REAL `generateText`
 * driving a deterministic `MockLanguageModelV3` that emits a tool call then text — so
 * the genuine `tool()` / `stopWhen` / multi-step path runs offline.
 */

const noSignal = () => new AbortController().signal;

/** The mock model's `doGenerate` type, derived from its own constructor so each
 *  returned result is contextually checked against the real V3 result shape (and the
 *  literal `finishReason`s aren't widened to `string`). */
type MockGenerate = NonNullable<
  NonNullable<ConstructorParameters<typeof MockLanguageModelV3>[0]>['doGenerate']
>;
/** The function member of the `doGenerate` union (the mock also accepts a static
 *  result), and its resolved V3 result shape — so each return is checked precisely. */
type MockGenerateFn = Extract<MockGenerate, (...args: never[]) => unknown>;
type V3GenerateResult = Awaited<ReturnType<MockGenerateFn>>;

/** Full nested V3 usage (the mock model must return the real provider shape). */
function v3Usage(input: number, output: number) {
  return {
    inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: undefined },
  };
}

describe('createAgentLoop', () => {
  it('reports unconfigured when no model is resolved (AI off / mock / no key)', async () => {
    const loop = createAgentLoop({ resolveModel: () => null });
    const out = await loop({
      intent: 'anything',
      tools: [],
      memoryContext: '',
      signal: noSignal(),
      maxSteps: 8,
      maxTokens: 1000,
    });
    expect(out).toEqual({ summary: '', totalTokens: 0, unconfigured: true });
  });

  it('builds an AI-SDK toolset from the LoopTools and maps the model result', async () => {
    const calls: Array<{ id: string; input: unknown }> = [];
    type GenArgs = Parameters<typeof generateText>[0];
    let captured: GenArgs | undefined;

    const fakeGenerate = (async (opts: GenArgs) => {
      captured = opts;
      // Stand in for the model: call files.read once through the built toolset.
      await opts.tools?.['files.read']?.execute?.({ path: '~/q3.pdf' }, {
        toolCallId: 'c1',
        messages: [],
      } as never);
      return { text: '  Read the brief.  ', totalUsage: { totalTokens: 123 } };
    }) as unknown as typeof generateText;

    const loop = createAgentLoop({
      resolveModel: () => ({ model: new MockLanguageModelV3(), label: 'fake' }),
      generate: fakeGenerate,
    });

    const tools: LoopTool[] = [
      {
        id: 'files.read',
        description: 'Read a file.',
        parameters: z.object({ path: z.string() }),
        execute: async (input) => {
          calls.push({ id: 'files.read', input });
          return { ok: true };
        },
      },
    ];

    const out = await loop({
      intent: 'Summarize the brief',
      tools,
      memoryContext: '- a prior fact',
      signal: noSignal(),
      maxSteps: 8,
      maxTokens: 1000,
    });

    // LoopTools → an AI-SDK toolset keyed by id, carrying the model-facing description.
    expect(Object.keys(captured!.tools ?? {})).toEqual(['files.read']);
    expect(captured!.tools?.['files.read']?.description).toBe('Read a file.');
    // Bounded: stop conditions are an array (step cap + token budget); stop is wired.
    expect(Array.isArray(captured!.stopWhen)).toBe(true);
    expect(captured!.abortSignal).toBeInstanceOf(AbortSignal);
    // The intent + recalled memory are folded into the prompt.
    expect(String(captured!.prompt)).toContain('a prior fact');
    expect(String(captured!.prompt)).toContain('Summarize the brief');
    // The model's tool call reached our LoopTool.execute with the parsed input.
    expect(calls).toEqual([{ id: 'files.read', input: { path: '~/q3.pdf' } }]);
    // Outcome maps text → trimmed summary and usage → totalTokens.
    expect(out).toEqual({ summary: 'Read the brief.', totalTokens: 123 });
  });

  it('drives a real generateText tool-call loop via the AI SDK (mock model)', async () => {
    const calls: string[] = [];
    let step = 0;
    const doGenerate: MockGenerate = async () => {
      step += 1;
      if (step === 1) {
        // Round 1: the model asks to call files.read.
        const result: V3GenerateResult = {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'c1',
              toolName: 'files.read',
              input: JSON.stringify({ path: '~/q3.pdf' }),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: v3Usage(10, 4),
          warnings: [],
        };
        return result;
      }
      // Round 2: with the tool result in context, the model answers.
      const result: V3GenerateResult = {
        content: [{ type: 'text', text: 'Read the Q3 brief.' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: v3Usage(8, 6),
        warnings: [],
      };
      return result;
    };
    const model = new MockLanguageModelV3({ doGenerate });

    const loop = createAgentLoop({ resolveModel: () => ({ model, label: 'mock' }) });
    const tools: LoopTool[] = [
      {
        id: 'files.read',
        description: 'Read a file.',
        parameters: z.object({ path: z.string() }),
        execute: async (input) => {
          calls.push((input as { path: string }).path);
          return { ok: true, text: 'KPI sheet' };
        },
      },
    ];

    const out = await loop({
      intent: 'Read the q3 brief',
      tools,
      memoryContext: '',
      signal: noSignal(),
      maxSteps: 4,
      maxTokens: 10_000,
    });

    expect(calls).toEqual(['~/q3.pdf']); // the model's tool call ran our tool
    expect(out.summary).toBe('Read the Q3 brief.'); // the final text became the summary
    expect(out.totalTokens).toBeGreaterThan(0); // usage surfaced for the meta line
  });
});
