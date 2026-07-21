import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `workflows.run` — execute one of the user's configured workflows (an ordered
 * chain of actions) through the same runner the launcher uses. Side-effecting
 * (every step acts), so it holds at the review gate before anything runs.
 */
const workflowsRunParameters = z.object({
  workflowId: z.string().describe('The configured workflow’s id (from actions.list).'),
});
type WorkflowsRunInput = z.infer<typeof workflowsRunParameters>;

export const workflowsRun: Tool = {
  id: 'workflows.run',
  description:
    'Run one of the user’s configured workflows by id — its actions execute in sequence, ' +
    'exactly as the user would from the bar. Side-effecting — the user reviews and ' +
    'approves before it runs. Use actions.list first to find the workflow id.',
  parameters: workflowsRunParameters,
  grant: TASK_TOOL_GRANT['workflows.run'],
  sideEffecting: true,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { workflowId } = (input ?? {}) as Partial<WorkflowsRunInput>;
    if (!workflowId?.trim()) return { ok: false, error: 'workflows.run needs a workflowId.' };
    const workflow = ctx.config.workflows.find((w) => w.id === workflowId);
    const res = await ctx.ports.launcher.runWorkflow(workflowId.trim());
    return res.ok
      ? {
          ok: true,
          detail: `ran “${workflow?.name ?? workflowId}” · ${workflow?.steps.length ?? '?'} steps`,
          data: { workflowId },
        }
      : { ok: false, error: res.error ?? 'Running the workflow failed.' };
  },
};
