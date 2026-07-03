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
    ports: { files: { read: async () => 'KPI: revenue up 18%' } },
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

  it('marks only slides.create as side-effecting (the review-gated tool)', () => {
    expect(TOOL_REGISTRY['slides.create'].sideEffecting).toBe(true);
    expect(TOOL_REGISTRY['files.read'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['memory.recall'].sideEffecting).toBe(false);
    expect(TOOL_REGISTRY['memory.write'].sideEffecting).toBe(false);
  });

  it('flags only slides.create as a stub (off by default, badged in the UI)', () => {
    expect(TOOL_REGISTRY['slides.create'].stub).toBe(true);
    expect(TOOL_REGISTRY['files.read'].stub).toBeFalsy();
    expect(TOOL_REGISTRY['memory.recall'].stub).toBeFalsy();
    expect(TOOL_REGISTRY['memory.write'].stub).toBeFalsy();
    // The stub says so to the model, so it can't pass stub output off as real.
    expect(TOOL_REGISTRY['slides.create'].description.toLowerCase()).toContain('stub');
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

  it('slides.create produces preview tiles', async () => {
    const res = await TOOL_REGISTRY['slides.create'].run(
      { count: 8, previews: ['title', 'kpis', 'growth', 'next'] },
      context(),
    );
    expect(res.ok).toBe(true);
    expect(res.previews).toEqual(['title', 'kpis', 'growth', 'next']);
    // The detail (and the result data) keep the stub honest — no "exported" claim.
    expect(res.detail).toContain('stub');
    expect((res.data as { stub: boolean }).stub).toBe(true);
  });
});
