import type { IpcApi, Config } from '@cockpitzero/shared';

/** Dummy config returned when the app runs in a normal browser tab (no preload). */
const MOCK_CONFIG: Config = {
  version: 1,
  settings: {
    hotkey: 'CommandOrControl+Shift+Space',
    theme: 'system',
    glass: true,
    launchAtLogin: false,
    telemetryEnabled: false,
  },
  actions: [],
  aliases: [],
  workflows: [],
  ai: {
    enabled: true,
    provider: 'mock',
    modelTier: 'pro',
    askFromBar: true,
    memoryEnabled: true,
    tools: ['files', 'calendar', 'slack'],
  },
};

/**
 * A no-op bridge used ONLY in a browser/dev context where the preload script
 * isn't present — it keeps the UI rendering without a real main process.
 */
const mockApi: IpcApi = {
  getConfig: async () => MOCK_CONFIG,
  setConfig: async (config) => config,
  resolveQuery: async () => ({ kind: 'results', results: [] }),
  searchSystem: async () => [],
  runAction: async () => ({ ok: true }),
  runWorkflow: async () => ({ ok: true }),
  openPath: async () => ({ ok: true }),
  getFileIcon: async () => null,
  getFavicon: async () => null,
  completePath: async () => [],
  askAI: async (prompt) => ({
    text:
      `**Mock answer** for “${prompt.trim()}” (dev bridge — no main process). Launch slipped ` +
      'to **Thursday** — staging is green, but the CDN cutover still needs sign-off from infra.',
    meta: 'cockpit-ai · mock · 31 messages read',
    suggestions: [
      {
        id: 'mock-draft-reply',
        title: 'Draft reply to Priya',
        subtitle: 'Rollback plan attached — flipping the flag now, QA can start at 2pm.',
        badge: 'Draft',
      },
      { id: 'mock-open-helix', title: 'Open #helix-launch', subtitle: 'Slack · 3 unread', badge: 'App' },
      {
        id: 'mock-add-task',
        title: 'Add “CDN sign-off” to Today',
        subtitle: 'Linear · due before EOD',
        badge: 'Task',
      },
    ],
  }),
  draftWorkflow: async (description) => ({ name: `Draft: ${description.trim()}`, steps: [] }),
  aiStatus: async () => ({ enabled: true, provider: 'mock', ok: true }),
  openSettings: async () => {},
  hideLauncher: async () => {},
  platform: 'darwin',
};

/**
 * Resolve the IPC bridge. In the real (packaged) renderer the preload script
 * injects `window.api`. If it's missing we fall back to the mock **only in dev**
 * (e.g. opening the page in a browser); in production a missing bridge means the
 * preload failed to load, so we throw loudly instead of silently swapping in a
 * no-op — which would make the launcher look alive while doing nothing.
 */
function resolveApi(): IpcApi {
  if (typeof window !== 'undefined' && window.api) return window.api;
  if (import.meta.env.DEV) {
    console.warn('[api] window.api missing — using mock bridge (dev/browser only).');
    return mockApi;
  }
  throw new Error(
    'Preload bridge (window.api) is unavailable — the preload script failed to load.',
  );
}

/**
 * Single import site for the preload bridge. Components import `api` from here
 * instead of reaching for `window.api` directly, keeping the IPC surface in one
 * typed place (and easy to stub).
 */
export const api: IpcApi = resolveApi();
