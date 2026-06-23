import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `memory.write` — append a fact to the local memory store. Gated by
 * `ai.memoryEnabled`. The write is to local, private storage (not the user's
 * library / not a synced surface), so it isn't treated as a review-gated
 * side-effect; the service no-ops cleanly when memory is off.
 */
interface MemoryWriteInput {
  text: string;
  kind?: string;
}

export const memoryWrite: Tool = {
  id: 'memory.write',
  grant: TASK_TOOL_GRANT['memory.write'],
  sideEffecting: false,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { text = '', kind } = (input ?? {}) as Partial<MemoryWriteInput>;
    const entry = await ctx.memory.write(text, kind);
    if (!entry) return { ok: false, error: 'Memory is off — nothing written.' };
    return { ok: true, detail: 'remembered for next time', data: { id: entry.id } };
  },
};
