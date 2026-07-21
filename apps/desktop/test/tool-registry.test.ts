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

/** A fake launcher port that records calls — no electron, no OS search. */
function fakeLauncher() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const port = {
    runAction: async (actionId: string, values?: string[]) => {
      calls.push({ method: 'runAction', args: [actionId, values] });
      return actionId === 'missing' ? { ok: false, error: `Unknown action: ${actionId}` } : { ok: true };
    },
    runWorkflow: async (workflowId: string) => {
      calls.push({ method: 'runWorkflow', args: [workflowId] });
      return { ok: true };
    },
    openPath: async (path: string) => {
      calls.push({ method: 'openPath', args: [path] });
      return { ok: true };
    },
    searchSystem: async (query: string) => {
      calls.push({ method: 'searchSystem', args: [query] });
      return [{ kind: 'app' as const, name: 'GitKraken', path: '/Applications/GitKraken.app' }];
    },
  };
  return { port, calls };
}

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
      launcher: fakeLauncher().port,
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

  it('marks exactly the acting tools as side-effecting (review-gated)', () => {
    expect(TOOL_REGISTRY['slack.send'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['calendar.create-event'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['actions.run'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['workflows.run'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['apps.open'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['files.read'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['memory.recall'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['memory.write'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['actions.list'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['apps.search'].sideEffecting).toBe(false);
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
        launcher: fakeLauncher().port,
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

  it('actions.list enumerates configured actions + workflows from the config', async () => {
    const config = defaultConfig();
    config.actions.push(
      { id: 'a1', title: 'GitHub Search', type: 'open-url', url: 'https://github.com/search?q={query}' },
      { id: 'a2', title: 'Signature', type: 'snippet', content: '— S' },
    );
    config.aliases.push({ id: 'al1', keyword: 'gs', label: 'GitHub Search', actionId: 'a1' });
    config.workflows.push({ id: 'w1', name: 'Morning', steps: ['a1', 'a2'] });

    const res = await TOOL_REGISTRY['actions.list'].run({}, context({ config }));
    expect(res.ok).toBe(true);
    expect(res.detail).toBe('2 actions · 1 workflows');
    const data = res.data as {
      actions: Array<{ id: string; keyword?: string; arguments: Array<{ name: string }> }>;
      workflows: Array<{ id: string; steps: number }>;
    };
    // The templated action surfaces its keyword and its synthesized {query} parameter.
    expect(data.actions[0]).toMatchObject({ id: 'a1', keyword: 'gs' });
    expect(data.actions[0]!.arguments.map((a) => a.name)).toEqual(['query']);
    expect(data.workflows[0]).toMatchObject({ id: 'w1', steps: 2 });
  });

  it('actions.run executes through the launcher port and fails on unknown ids', async () => {
    const { port, calls } = fakeLauncher();
    const config = defaultConfig();
    config.actions.push({ id: 'a1', title: 'GitHub Search', type: 'open-url', url: 'https://x.dev' });
    const ctx = context({ config });
    ctx.ports = { ...ctx.ports, launcher: port };

    const ok = await TOOL_REGISTRY['actions.run'].run({ actionId: 'a1', values: ['zod'] }, ctx);
    expect(ok.ok).toBe(true);
    expect(ok.detail).toBe('ran “GitHub Search”');
    expect(calls[0]).toEqual({ method: 'runAction', args: ['a1', ['zod']] });

    const bad = await TOOL_REGISTRY['actions.run'].run({ actionId: 'missing' }, ctx);
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('Unknown action');
  });

  it('workflows.run executes through the launcher port', async () => {
    const { port, calls } = fakeLauncher();
    const config = defaultConfig();
    config.workflows.push({ id: 'w1', name: 'Morning', steps: ['a1', 'a2'] });
    const ctx = context({ config });
    ctx.ports = { ...ctx.ports, launcher: port };

    const res = await TOOL_REGISTRY['workflows.run'].run({ workflowId: 'w1' }, ctx);
    expect(res.ok).toBe(true);
    expect(res.detail).toBe('ran “Morning” · 2 steps');
    expect(calls[0]).toEqual({ method: 'runWorkflow', args: ['w1'] });
  });

  it('apps.search returns system matches; apps.open opens a path through the port', async () => {
    const { port, calls } = fakeLauncher();
    const ctx = context();
    ctx.ports = { ...ctx.ports, launcher: port };

    const found = await TOOL_REGISTRY['apps.search'].run({ query: 'gitkraken' }, ctx);
    expect(found.ok).toBe(true);
    expect(found.detail).toBe('1 match');
    expect((found.data as { results: Array<{ path: string }> }).results[0]!.path).toBe(
      '/Applications/GitKraken.app',
    );

    const opened = await TOOL_REGISTRY['apps.open'].run(
      { path: '/Applications/GitKraken.app' },
      ctx,
    );
    expect(opened.ok).toBe(true);
    expect(calls.at(-1)).toEqual({ method: 'openPath', args: ['/Applications/GitKraken.app'] });

    // Blank input is a real failure, not a silent no-op.
    expect((await TOOL_REGISTRY['apps.search'].run({}, ctx)).ok).toBe(false);
    expect((await TOOL_REGISTRY['apps.open'].run({ path: '  ' }, ctx)).ok).toBe(false);
  });
});
