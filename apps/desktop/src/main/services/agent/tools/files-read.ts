import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `files.read` — a safe, read-only file tool (the first-set local capability).
 * It reaches the disk only through the injected `files` port (path-scoped,
 * size-capped, time-boxed there), so it stays unit-testable with a fake. The
 * file's text lands in `data` so the model can use it in later steps. Read-only,
 * so the runner auto-runs it (no review gate).
 */
const filesReadParameters = z.object({
  path: z.string().describe('Absolute or ~-prefixed path of the file to read.'),
});
type FilesReadInput = z.infer<typeof filesReadParameters>;

export const filesRead: Tool = {
  id: 'files.read',
  description:
    'Read the UTF-8 text of a local file (path-scoped, size-capped). Use it to ground ' +
    'the task in a file the user named. Read-only and safe — runs without approval.',
  parameters: filesReadParameters,
  grant: TASK_TOOL_GRANT['files.read'],
  sideEffecting: false,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { path } = (input ?? {}) as Partial<FilesReadInput>;
    if (!path) return { ok: false, error: 'files.read needs a path.' };
    const text = await ctx.ports.files.read(path);
    return { ok: true, detail: `read ${text.length} chars`, data: { path, text, chars: text.length } };
  },
};
