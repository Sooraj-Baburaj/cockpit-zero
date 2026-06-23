import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `memory.recall` — hybrid (semantic + keyword + recency) recall over the local
 * memory engine. Gated by `ai.memoryEnabled` (via the runner's grant check AND the
 * memory service's own guard, so it returns nothing when memory is off either way).
 * The match count is a real signal, so it overrides the step narration ("matched N
 * prior sessions").
 */
interface MemoryRecallInput {
  query: string;
  limit?: number;
}

export const memoryRecall: Tool = {
  id: 'memory.recall',
  grant: TASK_TOOL_GRANT['memory.recall'],
  sideEffecting: false,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { query = '', limit } = (input ?? {}) as Partial<MemoryRecallInput>;
    const hits = await ctx.memory.recall(query, limit);
    return {
      ok: true,
      detail: `matched ${hits.length} prior session${hits.length === 1 ? '' : 's'}`,
      data: { hits },
    };
  },
};
