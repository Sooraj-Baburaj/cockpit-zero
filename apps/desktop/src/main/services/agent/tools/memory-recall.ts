import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `memory.recall` — hybrid (semantic + keyword + recency) recall over the local
 * memory engine. Gated by `ai.memoryEnabled` (via the runner's grant check AND the
 * memory service's own guard, so it returns nothing when memory is off either way).
 * The match count is a real signal, so it overrides the step narration ("matched N
 * prior sessions").
 */
const memoryRecallParameters = z.object({
  query: z.string().describe('What to look up in the user’s memory.'),
  limit: z.number().int().positive().optional().describe('Max results (default 5).'),
});
type MemoryRecallInput = z.infer<typeof memoryRecallParameters>;

export const memoryRecall: Tool = {
  id: 'memory.recall',
  description:
    'Recall durable facts from the user’s local memory (semantic + keyword + recency). ' +
    'Use it to pull prior context before acting. Read-only — runs without approval.',
  parameters: memoryRecallParameters,
  grant: TASK_TOOL_GRANT['memory.recall'],
  sideEffecting: false,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { query = '', limit } = (input ?? {}) as Partial<MemoryRecallInput>;
    const hits = await ctx.memory.recall(query, limit);
    return {
      ok: true,
      detail: `matched ${hits.length} prior session${hits.length === 1 ? '' : 's'}`,
      data: { hits: hits.map((h) => ({ text: h.text, kind: h.kind })) },
    };
  },
};
