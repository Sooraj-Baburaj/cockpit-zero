import { z } from 'zod';
import { TASK_TOOL_GRANT, effectiveArguments } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `actions.list` — enumerate the user's configured launcher actions + workflows
 * (ids, titles, kinds, keywords, declared parameters) so the model can discover
 * what `actions.run` / `workflows.run` can execute. Read-only over the current
 * config — no ports, no side-effects.
 */
const actionsListParameters = z.object({});

export const actionsList: Tool = {
  id: 'actions.list',
  description:
    'List the user’s configured launcher actions and workflows: each action’s id, title, ' +
    'kind (open-url / open-app / run-command / snippet), trigger keyword, and required ' +
    'parameters, plus each workflow’s id and name. Call this first to find the right id ' +
    'before actions.run or workflows.run.',
  parameters: actionsListParameters,
  grant: TASK_TOOL_GRANT['actions.list'],
  sideEffecting: false,
  async run(_input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { actions, workflows, aliases } = ctx.config;
    const keywordOf = (actionId: string) =>
      aliases.find((a) => a.actionId === actionId)?.keyword;
    const data = {
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        ...(keywordOf(a.id) ? { keyword: keywordOf(a.id) } : {}),
        arguments: effectiveArguments(a).map((arg) => ({
          name: arg.name,
          required: arg.required,
        })),
      })),
      workflows: workflows.map((w) => ({ id: w.id, name: w.name, steps: w.steps.length })),
    };
    return {
      ok: true,
      detail: `${actions.length} actions · ${workflows.length} workflows`,
      data,
    };
  },
};
