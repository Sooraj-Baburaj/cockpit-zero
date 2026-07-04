import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `calendar.create-event` — create a **real** event on the user's primary
 * Google Calendar via the connected Calendar integration (production P10).
 * Side-effecting, so the runner holds it at the review gate (the user sees the
 * title + times) before anything is created; the `calendar` grant gates it
 * before that. A disconnected Calendar fails with a clear pointer to Console →
 * Integrations — never a fake success. The network touch lives behind
 * `ports.integrations`.
 */
const calendarCreateEventParameters = z.object({
  title: z.string().describe('The event title.'),
  startIso: z
    .string()
    .describe('Event start as an ISO-8601 datetime, e.g. 2026-07-04T15:00:00+05:30.'),
  endIso: z.string().describe('Event end as an ISO-8601 datetime (after the start).'),
  description: z.string().optional().describe('Optional event description/notes.'),
});
type CalendarCreateEventInput = z.infer<typeof calendarCreateEventParameters>;

export const calendarCreateEvent: Tool = {
  id: 'calendar.create-event',
  description:
    'Create a real event on the user’s primary Google Calendar through their connected ' +
    'account. Side-effecting — the user reviews and approves the exact title and times ' +
    'before it is created. Requires the Google Calendar integration to be connected.',
  parameters: calendarCreateEventParameters,
  grant: TASK_TOOL_GRANT['calendar.create-event'],
  sideEffecting: true,
  async run(input: unknown, ctx: ToolContext): Promise<ToolResult> {
    const { title, startIso, endIso, description } = (input ??
      {}) as Partial<CalendarCreateEventInput>;
    if (!title?.trim() || !startIso || !endIso) {
      return { ok: false, error: 'calendar.create-event needs a title, startIso, and endIso.' };
    }
    if (Number.isNaN(Date.parse(startIso)) || Number.isNaN(Date.parse(endIso))) {
      return { ok: false, error: 'startIso/endIso must be valid ISO-8601 datetimes.' };
    }
    const res = await ctx.ports.integrations.calendarCreateEvent({
      title: title.trim(),
      startIso,
      endIso,
      ...(description ? { description } : {}),
    });
    return res.ok
      ? { ok: true, detail: res.detail ?? `“${title}” created`, data: { title, link: res.link } }
      : { ok: false, error: res.error ?? 'Creating the calendar event failed.' };
  },
};
