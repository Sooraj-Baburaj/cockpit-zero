import type { IpcApi, Config, Digest, TaskRun } from '@cockpitzero/shared';

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
  routines: [
    {
      id: 'morning_digest',
      label: 'Morning briefing',
      kind: 'digest',
      enabled: true,
      sources: ['slack', 'gmail', 'teams', 'linear', 'github', 'notion'],
      rankBy: 'importance',
      schedule: '0 8 * * *',
      trigger: 'scheduled',
      deliver: 'window',
      summarize: { modelTier: 'mini', maxItems: 8 },
    },
  ],
};

/** A canned digest for the dev/browser bridge (mirrors the seeded morning_digest). */
const MOCK_DIGEST: Digest = {
  routineId: 'morning_digest',
  title: 'Morning briefing',
  updatedAt: '8:42 AM',
  sourceCount: 6,
  surfaced: 5,
  total: 17,
  groups: {
    now: [
      {
        id: 'm-priya',
        who: 'Priya Shah',
        source: 'slack',
        summary: 'Needs the rollback plan before the Helix CDN cutover — blocking QA.',
        when: '12m',
        bucket: 'now',
        score: 0.98,
        openPath: 'https://app.slack.com/client',
      },
      {
        id: 'm-aws',
        who: 'AWS Billing',
        source: 'gmail',
        summary: 'Budget alert: production spend hit 92% of the monthly cap.',
        when: '1h',
        bucket: 'now',
        score: 0.92,
      },
    ],
    wait: [
      {
        id: 'm-github',
        who: 'GitHub',
        source: 'github',
        summary: 'Two pull requests need review in cockpit-zero.',
        when: '4h',
        bucket: 'wait',
        score: 0.6,
      },
    ],
    noiseCount: 12,
  },
};

/** A canned task run for the dev/browser bridge — mirrors `ai-task.html` (two
 *  steps done, one running, two waiting, with the result tiles ready). */
const MOCK_TASK: TaskRun = {
  id: 'task_dev',
  intent: 'Build a deck from the Q3 brief',
  usingMemory: true,
  toolCount: 2,
  status: 'working',
  steps: [
    {
      id: 'step_0',
      title: 'Read q3-brief.pdf',
      state: 'done',
      tool: 'files.read',
      detail: '14 pages · 6 KPIs extracted',
    },
    {
      id: 'step_1',
      title: "Pull revenue numbers from last week's standup",
      state: 'done',
      tool: 'memory.recall',
      detail: 'matched 3 prior sessions',
    },
    {
      id: 'step_2',
      title: 'Generate 8 slides',
      state: 'running',
      tool: 'slides.create',
      detail: 'drafting “Growth & retention”…',
      progress: 0.62,
    },
    { id: 'step_3', title: 'Apply Sahara theme', state: 'waiting' },
    { id: 'step_4', title: 'Export to Keynote', state: 'waiting' },
  ],
  result: { kind: 'slides', previews: ['title', 'kpis', 'growth', 'next'], openLabel: 'Open in Keynote' },
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
      {
        id: 'mock-open-helix',
        title: 'Open #helix-launch',
        subtitle: 'Slack · 3 unread',
        badge: 'App',
      },
      {
        id: 'mock-add-task',
        title: 'Add “CDN sign-off” to Today',
        subtitle: 'Linear · due before EOD',
        badge: 'Task',
      },
    ],
  }),
  draftWorkflow: async () => ({
    name: 'Morning routine',
    keyword: 'morning',
    steps: [
      {
        actionId: null,
        title: 'Open dashboards',
        target: 'Datadog · Linear · Stripe',
        kindLabel: 'URL ×3',
        action: {
          id: 'draft-dashboards',
          title: 'Open dashboards',
          type: 'run-command',
          command: 'open',
          args: ['https://app.datadoghq.com', 'https://linear.app'],
        },
      },
      {
        actionId: null,
        title: 'Start focus timer',
        target: 'timer start --minutes 50',
        kindLabel: 'Command',
        action: {
          id: 'draft-timer',
          title: 'Start focus timer',
          type: 'run-command',
          command: 'timer',
          args: ['start', '--minutes', '50'],
        },
      },
      {
        actionId: null,
        title: 'Post “Starting standup” to #team',
        target: 'Slack · #team-apollo',
        kindLabel: 'App',
        action: { id: 'draft-slack', title: 'Post to #team', type: 'open-app', target: 'Slack' },
      },
    ],
  }),
  aiStatus: async () => ({ enabled: true, provider: 'mock', ok: true }),
  runRoutine: async () => MOCK_DIGEST,
  getDigest: async () => MOCK_DIGEST,
  listRoutines: async () => MOCK_CONFIG.routines,
  taskRun: async () => ({ taskId: MOCK_TASK.id }),
  taskGet: async () => MOCK_TASK,
  taskStop: async () => ({ ok: true }),
  taskApprove: async () => ({ ok: true }),
  onTaskUpdate: () => () => {},
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
