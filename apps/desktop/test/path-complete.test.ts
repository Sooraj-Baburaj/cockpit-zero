import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completePath } from '../src/main/services/path-complete.js';

/**
 * `completePath` is pure Node (fs/os/path) — no electron — so it runs in plain
 * vitest. We build a small temp tree and assert the autocomplete behavior.
 */
describe('completePath', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cz-paths-'));
    await mkdir(join(dir, 'Visual Studio Code.app'));
    await mkdir(join(dir, 'Vivaldi.app'));
    await writeFile(join(dir, 'notes.txt'), '');
    await writeFile(join(dir, '.hidden'), '');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('suggests entries matching a partial last segment, case-insensitively', async () => {
    const results = await completePath(join(dir, 'vi'));
    expect(results).toContain(join(dir, 'Visual Studio Code.app'));
    expect(results).toContain(join(dir, 'Vivaldi.app'));
    expect(results).not.toContain(join(dir, 'notes.txt'));
  });

  it('lists a directory when the input ends with a separator', async () => {
    const results = await completePath(dir + sep);
    expect(results).toContain(join(dir, 'notes.txt'));
  });

  it('omits dotfiles', async () => {
    const results = await completePath(dir + sep);
    expect(results.some((r) => r.endsWith('.hidden'))).toBe(false);
  });

  it('returns [] for a relative fragment and for an unreadable dir', async () => {
    expect(await completePath('relative/path')).toEqual([]);
    expect(await completePath(join(dir, 'does-not-exist', 'x'))).toEqual([]);
  });
});
