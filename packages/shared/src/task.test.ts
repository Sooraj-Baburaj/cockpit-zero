import { describe, it, expect } from 'vitest';
import {
  AGENT_TOOL_IDS,
  TASK_TOOL_GRANT,
  isToolAllowed,
  isMemoryTool,
  taskStatusLabel,
} from './task.js';
import type { AgentToolId } from './task.js';
import type { TaskRun, TaskStep } from './types.js';

const ALL_GRANTED = {
  tools: ['files', 'calendar', 'slack', 'slides-sheets'] as const,
  memoryEnabled: true,
};

function step(state: TaskStep['state']): TaskStep {
  return { id: state, title: state, state };
}

function run(over: Partial<TaskRun> = {}): TaskRun {
  return {
    id: 't1',
    intent: 'Build a deck from the Q3 brief',
    steps: [],
    usingMemory: true,
    toolCount: 2,
    status: 'working',
    ...over,
  };
}

describe('tool catalog + grants', () => {
  it('every catalog tool has a grant mapping', () => {
    for (const id of AGENT_TOOL_IDS) expect(TASK_TOOL_GRANT[id]).toBeDefined();
    expect(Object.keys(TASK_TOOL_GRANT).sort()).toEqual([...AGENT_TOOL_IDS].sort());
  });

  it('gates an ai.tools-granted tool by its grant', () => {
    expect(isToolAllowed('files.read', ALL_GRANTED)).toBe(true);
    expect(isToolAllowed('files.read', { ...ALL_GRANTED, tools: ['calendar'] })).toBe(false);
    expect(isToolAllowed('slides.create', { ...ALL_GRANTED, tools: ['files'] })).toBe(false);
  });

  it('gates memory tools by memoryEnabled, not a per-tool grant', () => {
    expect(isMemoryTool('memory.recall')).toBe(true);
    expect(isMemoryTool('files.read')).toBe(false);
    // memory tools ignore `tools` entirely — only memoryEnabled matters.
    expect(isToolAllowed('memory.recall', { tools: [], memoryEnabled: true })).toBe(true);
    expect(isToolAllowed('memory.write', { tools: [], memoryEnabled: false })).toBe(false);
  });
});

describe('taskStatusLabel', () => {
  it('counts done + the running step while working', () => {
    const r = run({
      steps: [step('done'), step('done'), step('running'), step('waiting'), step('waiting')],
    });
    expect(taskStatusLabel(r)).toBe('Working · 3 of 5 steps');
  });

  it('describes the other lifecycle states', () => {
    const steps = [step('done'), step('done')];
    expect(taskStatusLabel(run({ status: 'planning', steps }))).toBe('Planning…');
    expect(taskStatusLabel(run({ status: 'review', steps }))).toBe('Ready to review');
    expect(taskStatusLabel(run({ status: 'done', steps }))).toBe('Done · 2 steps');
    expect(taskStatusLabel(run({ status: 'stopped', steps }))).toBe('Stopped');
    expect(taskStatusLabel(run({ status: 'error', steps, note: 'Enable Slides & Sheets' }))).toBe(
      'Enable Slides & Sheets',
    );
  });

  it('keeps the count valid', () => {
    // no done, no running yet — still reads "1 of N", never "0 of N".
    const r = run({ steps: [step('waiting'), step('waiting')] });
    expect(taskStatusLabel(r)).toBe('Working · 1 of 2 steps');
  });
});

// Type-level: the catalog tuple element type IS AgentToolId (compile guard).
const _ids: readonly AgentToolId[] = AGENT_TOOL_IDS;
void _ids;
