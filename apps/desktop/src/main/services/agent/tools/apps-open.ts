import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `apps.open` — open an application or file by absolute path, exactly as the
 * user would by picking a system-search row in the launcher. Side-effecting
 * (it launches/opens things on the user's machine), so the runner holds it at
 * the review gate with the path visible before anything opens.
 */
const appsOpenParameters = z.object({
  path: z.string().describe('The absolute path of the app or file (from apps.search).'),
});
type AppsOpenInput = z.infer<typeof appsOpenParameters>;

export const appsOpen: Tool = {
  id: 'apps.open',
  description:
    'Open an installed application or a file by its absolute path, as the user would from ' +
    'a launcher result. Side-effecting — the user reviews and approves the exact path ' +
    'before it opens. Get the path from apps.search; never guess one.',
  parameters: appsOpenParameters,
  grant: TASK_TOOL_GRANT['apps.open'],
  sideEffecting: true,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { path } = (input ?? {}) as Partial<AppsOpenInput>;
    if (!path?.trim()) return { ok: false, error: 'apps.open needs a path.' };
    const res = await ctx.ports.launcher.openPath(path.trim());
    return res.ok
      ? { ok: true, detail: `opened ${path.trim()}`, data: { path: path.trim() } }
      : { ok: false, error: res.error ?? 'Opening the path failed.' };
  },
};
