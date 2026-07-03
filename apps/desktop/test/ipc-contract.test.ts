import { describe, it, expect } from 'vitest';
import { IpcChannels, type IpcApi } from '@cockpitzero/shared';

/**
 * Contract test: the preload bridge surface (IpcApi) and the channel registry
 * (IpcChannels) must stay in lockstep. This catches a channel added on one side
 * but forgotten on the other.
 */
describe('IPC contract', () => {
  it('every invoke channel has a matching IpcApi method', () => {
    // The request/response (invoke) surface. `platform` (a value) and the
    // push-channel subscribers `onTaskUpdate` / `onAiStream` (registered against
    // TASK_UPDATE_CHANNEL / AI_STREAM_CHANNEL, not invokes) are IpcApi members
    // WITHOUT an `IpcChannels` entry by design, so they're excluded here.
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
      'checkHotkey',
      'askAI',
      'askAIStream',
      'cancelAiStream',
      'draftWorkflow',
      'aiStatus',
      'runRoutine',
      'getDigest',
      'listRoutines',
      'taskRun',
      'taskGet',
      'taskStop',
      'taskApprove',
      'memoryStats',
      'memorySearch',
      'memoryForget',
      'memoryClear',
      'setSecret',
      'clearSecret',
      'secretStatus',
      'openConsole',
      'hideLauncher',
    ];
    expect(Object.keys(IpcChannels).sort()).toEqual([...channelMethods].sort());
  });

  it('channel values are unique', () => {
    const values = Object.values(IpcChannels);
    expect(new Set(values).size).toBe(values.length);
  });

  it('exposes no secret-read channel (plaintext never crosses the bridge)', () => {
    // The vault is set/clear/status only — a `getSecret` channel would be a
    // plaintext read path to the renderer, which P2 forbids by design.
    const keys = Object.keys(IpcChannels);
    const values: string[] = Object.values(IpcChannels);
    expect(keys).not.toContain('getSecret');
    expect(values).not.toContain('secret:get');
  });
});
