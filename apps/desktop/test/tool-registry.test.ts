import { describe, it, expect } from 'vitest';
import { AGENT_TOOL_IDS, TASK_TOOL_GRANT, defaultConfig } from '@cockpitzero/shared';
import { TOOL_REGISTRY, type ToolContext } from '../src/main/services/agent/tools/registry.js';
import {
  createMemoryService,
  createInMemoryMemoryStore,
} from '../src/main/services/agent/memory-service.js';
import { createHashEmbedder } from '../src/main/services/agent/embedder.js';

/**
 * The registry mirrors the action-runner registry: a mapped type makes it
 * exhaustive (compile-time), and here we assert it at runtime too — every catalog
 * id has an impl whose declared grant matches the shared map — plus exercise each
 * tool with a fake context (no electron, no disk). Memory is wired with the real
 * in-memory store + the dependency-free hash embedder.
 */

function context(over: Partial<ToolContext> = {}): ToolContext {
  const config = defaultConfig();
  const memory = createMemoryService({
    store: createInMemoryMemoryStore(),
    embedder: createHashEmbedder(),
    extractor: { extract: async () => [] },
    getConfig: () => config,
  });
  return {
    config,
    memory,
    ports: {
      files: { read: async () => 'KPI: revenue up 18%' },
      // Fake connectors behind the port (P10 test plan) — no network.
      integrations: {
        slackSend: async ({ channel }) => ({ ok: true, detail: `sent to ${channel}` }),
        calendarCreateEvent: async ({ title }) => ({ ok: true, detail: `“${title}” created` }),
      },
    },
    ...over,
  };
}

describe('tool registry', () => {
  it('has an exhaustive impl for every catalog tool id', () => {
    expect(Object.keys(TOOL_REGISTRY).sort()).toEqual([...AGENT_TOOL_IDS].sort());
    for (const id of AGENT_TOOL_IDS) {
      expect(TOOL_REGISTRY[id].id).toBe(id);
      // The tool's declared grant matches the shared source-of-truth map.
      expect(TOOL_REGISTRY[id].grant).toBe(TASK_TOOL_GRANT[id]);
      // Each tool carries the model-facing contract the real agent loop needs:
      // a non-empty description + a Zod parameter schema.
      expect(TOOL_REGISTRY[id].description.length).toBeGreaterThan(0);
      expect(typeof TOOL_REGISTRY[id].parameters.safeParse).toBe('function');
    }
  });

  it('marks exactly the external write tools as side-effecting (review-gated)', () => {
    expect(TOOL_REGISTRY['slack.send'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['calendar.create-event'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['files.read'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['memory.recall'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['memory.write'].sideEffecting).toBe(false);
  });

  it('validates tool input against the declared Zod parameters', () => {
    expect(TOOL_REGISTRY['files.read'].parameters.safeParse({ path: '~/q3.pdf' }).success).toBe(
      true,
    );
    expect(TOOL_REGISTRY['files.read'].parameters.safeParse({}).success).toBe(false);
    expect(
      TOOL_REGISTRY['memory.write'].parameters.safeParse({ text: 'remember this' }).success,
    ).toBe(true);
  });

  it('files.read returns the file text through the injected port', async () => {
    const res = await TOOL_REGISTRY['files.read'].run({ path: '~/Documents/q3.pdf' }, context());
    expect(res.ok).toBe(true);
    expect((res.data as { text: string }).text).toContain('revenue');
  });

  it('files.read fails without a path', async () => {
    const res = await TOOL_REGISTRY['files.read'].run({}, context());
    expect(res.ok).toBe(false);
  });

  it('memory.recall reports the match count it found', async () => {
    const ctx = context();
    await ctx.memory.write('Q3 revenue numbers from the standup', 'session');
    const res = await TOOL_REGISTRY['memory.recall'].run({ query: 'revenue standup' }, ctx);
    expect(res.ok).toBe(true);
    expect(res.detail).toBe('matched 1 prior session');
  });

  it('slack.send posts through the injected integrations port', async () => {
    const res = await TOOL_REGISTRY['slack.send'].run(
      { channel: '#team', text: 'Q3 summary' },
      context(),
    );
    expect(res.ok).toBe(true);
    expect(res.detail).toBe('sent to #team');
  });

  it('slack.send surfaces a disconnected Slack as a real failure, never a fake success', async () => {
    const ctx = context({
      ports: {
        files: { read: async () => '' },
        integrations: {
          slackSend: async () => ({
            ok: false,
            error: 'Slack is not connected — connect it in Console → Integrations.',
          }),
          calendarCreateEvent: async () => ({ ok: false, error: 'not connected' }),
        },
      },
    });
    const res = await TOOL_REGISTRY['slack.send'].run({ channel: '#team', text: 'hi' }, ctx);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('not connected');
  });

  it('calendar.create-event validates its ISO datetimes before touching the port', async () => {
    const bad = await TOOL_REGISTRY['calendar.create-event'].run(
      { title: 'Standup', startIso: 'tomorrow', endIso: 'later' },
      context(),
    );
    expect(bad.ok).toBe(false);

    const ok = await TOOL_REGISTRY['calendar.create-event'].run(
      { title: 'Standup', startIso: '2026-07-06T09:00:00Z', endIso: '2026-07-06T09:15:00Z' },
      context(),
    );
    expect(ok.ok).toBe(true);
    expect(ok.detail).toBe('“Standup” created');
  });
});
