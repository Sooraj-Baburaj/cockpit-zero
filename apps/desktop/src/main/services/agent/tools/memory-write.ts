import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `memory.write` — append a fact to the local memory store. Gated by
 * `ai.memoryEnabled`. The write is to local, private storage (not the user's
 * library / not a synced surface), so it isn't treated as a review-gated
 * side-effect; the service no-ops cleanly when memory is off.
 */
const memoryWriteParameters = z.object({
  text: z.string().describe('A single durable fact worth recalling in a future session.'),
  kind: z.string().optional().describe('Optional category, e.g. "preference" or "task".'),
});
type MemoryWriteInput = z.infer<typeof memoryWriteParameters>;

export const memoryWrite: Tool = {
  id: 'memory.write',
  description:
    'Save one durable fact to the user’s local, private memory for future sessions. ' +
    'Writes only on-device (not a synced or shared surface), so it runs without approval.',
  parameters: memoryWriteParameters,
  grant: TASK_TOOL_GRANT['memory.write'],
  sideEffecting: false,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { text = '', kind } = (input ?? {}) as Partial<MemoryWriteInput>;
    const entry = await ctx.memory.write(text, kind);
    if (!entry) return { ok: false, error: 'Memory is off — nothing written.' };
    return { ok: true, detail: 'remembered for next time', data: { id: entry.id } };
  },
};
