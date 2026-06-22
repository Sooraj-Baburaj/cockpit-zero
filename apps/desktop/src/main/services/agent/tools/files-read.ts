import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `files.read` — a safe, read-only file tool (the first-set local capability).
 * It reaches the disk only through the injected `files` port (path-scoped,
 * size-capped, time-boxed there), so it stays unit-testable with a fake. The
 * file's text lands in `data` for later steps; the step's human narration comes
 * from the planner (canned with the mock provider, model-authored later), so the
 * tool itself returns no `detail` override.
 */
interface FilesReadInput {
  path: string;
}

export const filesRead: Tool = {
  id: 'files.read',
  grant: TASK_TOOL_GRANT['files.read'],
  sideEffecting: false,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { path } = (input ?? {}) as Partial<FilesReadInput>;
    if (!path) return { ok: false, error: 'files.read needs a path.' };
    const text = await ctx.ports.files.read(path);
    return { ok: true, data: { path, text, chars: text.length } };
  },
};
