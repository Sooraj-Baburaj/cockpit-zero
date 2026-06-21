import { describe, it, expect } from 'vitest';
import { IpcChannels, type IpcApi } from '@cockpitzero/shared';

/**
 * Contract test: the preload bridge surface (IpcApi) and the channel registry
 * (IpcChannels) must stay in lockstep. This catches a channel added on one side
 * but forgotten on the other.
 */
describe('IPC contract', () => {
  it('every IpcApi method has a matching channel', () => {
    const channelMethods: Array<keyof IpcApi> = [
      'getConfig',
      'setConfig',
      'resolveQuery',
      'searchSystem',
      'runAction',
      'runWorkflow',
      'openPath',
      'getFileIcon',
      'getFavicon',
      'completePath',
      'openSettings',
      'hideLauncher',
    ];
    expect(Object.keys(IpcChannels).sort()).toEqual([...channelMethods].sort());
  });

  it('channel values are unique', () => {
    const values = Object.values(IpcChannels);
    expect(new Set(values).size).toBe(values.length);
  });
});
