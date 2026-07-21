import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `apps.search` — search installed applications and files through the same
 * system-search providers the launcher uses (Spotlight / Search index /
 * plocate, all time-boxed in `infra/`). Read-only: it returns names + paths;
 * opening one is a separate, review-gated `apps.open` call.
 */
const appsSearchParameters = z.object({
  query: z.string().describe('What to look for — an app name or (partial) file name.'),
});
type AppsSearchInput = z.infer<typeof appsSearchParameters>;

export const appsSearch: Tool = {
  id: 'apps.search',
  description:
    'Search the user’s installed applications and files by name (the launcher’s system ' +
    'search). Returns matches with their absolute paths — pass a result’s path to ' +
    'apps.open to launch it. Read-only.',
  parameters: appsSearchParameters,
  grant: TASK_TOOL_GRANT['apps.search'],
  sideEffecting: false,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { query } = (input ?? {}) as Partial<AppsSearchInput>;
    if (!query?.trim()) return { ok: false, error: 'apps.search needs a query.' };
    const results = await ctx.ports.launcher.searchSystem(query.trim());
    return {
      ok: true,
      detail:
        results.length === 0
          ? 'no matches'
          : `${results.length} match${results.length === 1 ? '' : 'es'}`,
      data: { results },
    };
  },
};
