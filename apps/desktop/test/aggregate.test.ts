import { describe, it, expect } from 'vitest';
import { mergeResults } from '../src/main/services/search/aggregate.js';
import type { ActionItem, AppItem, FileItem, WorkflowItem } from '@cockpitzero/shared';

const action = (id: string, score: number): ActionItem => ({
  kind: 'action',
  id,
  title: id,
  score,
  matches: [],
  action: { id, title: id, type: 'open-url', url: 'https://example.com' },
});
const workflow = (id: string, score: number): WorkflowItem => ({
  kind: 'workflow',
  id,
  title: id,
  score,
  matches: [],
  workflow: { id, name: id, steps: ['x'] },
});
const app = (path: string, score: number): AppItem => ({
  kind: 'app',
  id: path,
  title: path,
  score,
  matches: [],
  path,
});
const file = (path: string, score: number): FileItem => ({
  kind: 'file',
  id: path,
  title: path,
  score,
  matches: [],
  path,
});

describe('mergeResults', () => {
  it('orders sections actions → workflows → apps → files regardless of score', () => {
    const merged = mergeResults(
      [action('a', 1), workflow('w', 100)],
      [app('/A.app', 100)],
      [file('/f', 50)],
      10,
    );
    expect(merged.map((m) => m.kind)).toEqual(['action', 'workflow', 'app', 'file']);
  });

  it('sorts by score within a section', () => {
    const merged = mergeResults([], [app('/low.app', 1), app('/high.app', 9)], [], 10);
    expect(merged.map((m) => m.title)).toEqual(['/high.app', '/low.app']);
  });

  it('dedupes by id, keeping the higher-priority source (app over file)', () => {
    const shared = '/Applications/Safari.app';
    const merged = mergeResults([], [app(shared, 10)], [file(shared, 99)], 10);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.kind).toBe('app');
  });

  it('caps to the limit', () => {
    const apps = Array.from({ length: 20 }, (_, i) => app(`/App${i}.app`, i));
    expect(mergeResults([], apps, [], 5)).toHaveLength(5);
  });
});
