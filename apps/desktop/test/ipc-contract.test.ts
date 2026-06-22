import { describe, it, expect } from 'vitest';
import { IpcChannels, type IpcApi } from '@cockpitzero/shared';

/**
 * Contract test: the preload bridge surface (IpcApi) and the channel registry
 * (IpcChannels) must stay in lockstep. This catches a channel added on one side
 * but forgotten on the other.
 */
describe('IPC contract', () => {
  it('every invoke channel has a matching IpcApi method', () => {
    // The request/response (invoke) surface. `platform` (a value) and
    // `onTaskUpdate` (the push-channel subscriber, registered against
    // TASK_UPDATE_CHANNEL, not an invoke) are IpcApi members WITHOUT an
    // `IpcChannels` entry by design, so they're excluded here.
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
      'askAI',
      'draftWorkflow',
      'aiStatus',
      'runRoutine',
      'getDigest',
      'listRoutines',
      'taskRun',
      'taskGet',
      'taskStop',
      'taskApprove',
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
