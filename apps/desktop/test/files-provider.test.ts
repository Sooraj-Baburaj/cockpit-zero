import { describe, it, expect, vi } from 'vitest';
import { createFilesProvider } from '../src/main/services/search/files-provider.js';
import type { FileEntry } from '../src/main/services/search/provider.js';

/**
 * The files provider depends on an injected `searchFiles` adapter, so we test its
 * mapping + min-length gate with a fake — no child_process / OS index.
 */
const files: FileEntry[] = [
  { name: 'report.pdf', path: '/Users/me/Documents/report.pdf' },
  { name: 'report-final.pdf', path: '/Users/me/Desktop/report-final.pdf' },
];

describe('files-provider', () => {
  it('maps OS results to FileItems with a parent-dir subtitle', async () => {
    const provider = createFilesProvider(async () => files);
    const results = await provider.search('report', 10);
    expect(results.every((r) => r.kind === 'file')).toBe(true);
    const top = results.find((r) => r.title === 'report.pdf');
    expect(top?.subtitle).toBe('/Users/me/Documents');
  });

  it('skips short queries (min length 2) without calling the OS', async () => {
    const searchFiles = vi.fn(async () => files);
    const provider = createFilesProvider(searchFiles);
    expect(await provider.search('a', 10)).toEqual([]);
    expect(searchFiles).not.toHaveBeenCalled();
  });

  it('returns nothing when the limit is zero', async () => {
    const provider = createFilesProvider(async () => files);
    expect(await provider.search('report', 0)).toEqual([]);
  });
});
