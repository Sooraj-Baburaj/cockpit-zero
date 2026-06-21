import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveIconPath } from '../src/main/infra/icon-path.js';

/**
 * `resolveIconPath` is pure Node (fs/os/path) — no electron — so it runs in
 * plain vitest. `dirs`/`platform` are injected so the macOS name→bundle lookup
 * is deterministic regardless of the host OS.
 */
describe('resolveIconPath', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cz-icons-'));
    await mkdir(join(dir, 'Google Chrome.app'));
    await writeFile(join(dir, 'notes.txt'), '');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns an existing path unchanged (system-search case)', () => {
    const file = join(dir, 'notes.txt');
    expect(resolveIconPath(file, [dir], 'darwin')).toBe(file);
  });

  it('maps a bare app name to its .app bundle on macOS', () => {
    expect(resolveIconPath('Google Chrome', [dir], 'darwin')).toBe(
      join(dir, 'Google Chrome.app'),
    );
    // A "<name>.app" target resolves the same way.
    expect(resolveIconPath('Google Chrome.app', [dir], 'darwin')).toBe(
      join(dir, 'Google Chrome.app'),
    );
  });

  it('does not resolve names off macOS', () => {
    expect(resolveIconPath('Google Chrome', [dir], 'win32')).toBeNull();
  });

  it('returns null for an unknown name and for empty input', () => {
    expect(resolveIconPath('Not Installed', [dir], 'darwin')).toBeNull();
    expect(resolveIconPath('   ', [dir], 'darwin')).toBeNull();
    expect(resolveIconPath('', [dir], 'darwin')).toBeNull();
  });
});
