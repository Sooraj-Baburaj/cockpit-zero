import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `actions.run` — execute one of the user's configured launcher actions, exactly
 * as if they had run it from the bar (same execution path — see
 * `services/launcher-exec.ts`). Side-effecting (it opens URLs/apps, runs
 * commands, copies snippets), so the runner holds it at the review gate with the
 * action id + argument values visible before anything runs.
 */
const actionsRunParameters = z.object({
  actionId: z.string().describe('The configured action’s id (from actions.list).'),
  values: z
    .array(z.string())
    .optional()
    .describe('Positional values for the action’s declared parameters, in order.'),
});
type ActionsRunInput = z.infer<typeof actionsRunParameters>;

export const actionsRun: Tool = {
  id: 'actions.run',
  description:
    'Run one of the user’s configured launcher actions by id — open its URL or app, run ' +
    'its command, or copy its snippet, exactly as the user would from the bar. Pass ' +
    '`values` in order for any required parameters. Side-effecting — the user reviews and ' +
    'approves before it runs. Use actions.list first to find the id and its parameters.',
  parameters: actionsRunParameters,
  grant: TASK_TOOL_GRANT['actions.run'],
  sideEffecting: true,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { actionId, values } = (input ?? {}) as Partial<ActionsRunInput>;
    if (!actionId?.trim()) return { ok: false, error: 'actions.run needs an actionId.' };
    const title = ctx.config.actions.find((a) => a.id === actionId)?.title;
    const res = await ctx.ports.launcher.runAction(actionId.trim(), values);
    return res.ok
      ? { ok: true, detail: `ran “${title ?? actionId}”`, data: { actionId } }
      : { ok: false, error: res.error ?? 'Running the action failed.' };
  },
};
