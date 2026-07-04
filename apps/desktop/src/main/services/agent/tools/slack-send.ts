import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `slack.send` — post a **real** Slack message via the connected Slack
 * integration (production P10, replacing the P7 stub era). Side-effecting, so
 * the runner holds it at the review gate (the user sees channel + text) before
 * anything is posted; the `slack` grant gates it before that. A disconnected
 * Slack fails with a clear pointer to Console → Integrations — never a fake
 * success. The network touch lives behind `ports.integrations`.
 */
const slackSendParameters = z.object({
  channel: z
    .string()
    .describe('Where to post: a #channel-name, or a Slack channel/user id (C…/D…/U…).'),
  text: z.string().describe('The message text to post.'),
});
type SlackSendInput = z.infer<typeof slackSendParameters>;

export const slackSend: Tool = {
  id: 'slack.send',
  description:
    'Send a real message to a Slack channel or DM through the user’s connected Slack ' +
    'account. Side-effecting — the user reviews and approves the exact channel and text ' +
    'before it posts. Requires the Slack integration to be connected.',
  parameters: slackSendParameters,
  grant: TASK_TOOL_GRANT['slack.send'],
  sideEffecting: true,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { channel, text } = (input ?? {}) as Partial<SlackSendInput>;
    if (!channel?.trim() || !text?.trim()) {
      return { ok: false, error: 'slack.send needs a channel and text.' };
    }
    const res = await ctx.ports.integrations.slackSend({ channel: channel.trim(), text });
    return res.ok
      ? { ok: true, detail: res.detail ?? `sent to ${channel}`, data: { channel } }
      : { ok: false, error: res.error ?? 'Sending the Slack message failed.' };
  },
};
