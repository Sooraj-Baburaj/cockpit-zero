import { describe, it, expect, vi } from 'vitest';
import { createAppsProvider } from '../src/main/services/search/apps-provider.js';
import type { AppEntry } from '../src/main/services/search/provider.js';

/**
 * The apps provider depends on an injected scan function (dependency inversion),
 * so we exercise its ranking + caching here with a fake list — no FS access.
 */
const apps: AppEntry[] = [
  { name: 'Safari', path: '/Applications/Safari.app' },
  { name: 'Slack', path: '/Applications/Slack.app' },
  { name: 'Visual Studio Code', path: '/Applications/Visual Studio Code.app' },
];

describe('apps-provider', () => {
  it('fuzzy-matches app names and returns AppItems', async () => {
    const provider = createAppsProvider(async () => apps);
    const results = await provider.search('saf', 10);
    const top = results[0];
    expect(top?.kind).toBe('app');
    expect(top?.title).toBe('Safari');
    if (top?.kind === 'app') expect(top.path).toBe('/Applications/Safari.app');
  });

  it('returns nothing for an empty query', async () => {
    const provider = createAppsProvider(async () => apps);
    expect(await provider.search('', 10)).toEqual([]);
  });

  it('respects the limit', async () => {
    const provider = createAppsProvider(async () => apps);
    expect((await provider.search('s', 1)).length).toBeLessThanOrEqual(1);
  });

  it('caches the scan across calls', async () => {
    const scan = vi.fn(async () => apps);
    const provider = createAppsProvider(scan);
    await provider.search('saf', 10);
    await provider.search('sla', 10);
    expect(scan).toHaveBeenCalledTimes(1);
  });
});
