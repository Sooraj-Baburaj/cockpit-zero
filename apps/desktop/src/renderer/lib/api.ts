import type {
  IpcApi,
  AiStreamEvent,
  Config,
  Digest,
  MemoryRecord,
  TaskRun,
} from '@cockpitzero/shared';

/** Dummy config returned when the app runs in a normal browser tab (no preload). */
const MOCK_CONFIG: Config = {
  version: 1,
  settings: {
    hotkey: 'CommandOrControl+J',
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
    model: '',
    modelTier: 'pro',
    askFromBar: true,
    memoryEnabled: true,
    embeddingSource: 'local',
    tools: ['files', 'calendar', 'slack'],
    maxSteps: 12,
    maxToolCalls: 16,
    maxTokens: 120_000,
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
  result: {
    kind: 'slides',
    previews: ['title', 'kpis', 'growth', 'next'],
    openLabel: 'Open in Keynote',
  },
};

/** In-memory secrets for the dev/browser bridge — there's no main process (and
 *  no OS keychain) in a plain browser tab, so the vault is just a Set of names.
 *  Mirrors the real contract: status reports presence, never the value. */
const mockSecrets = new Set<string>();

/** Seed memories for the dev/browser bridge (no main process / no LanceDB) — so the
 *  Console memory view renders without a real engine. Filtered by a naive substring
 *  match, which is enough to exercise the search box in a browser tab. */
let mockMemories: MemoryRecord[] = [
  {
    id: 'mem-1',
    ts: Date.now() - 86_400_000 * 3,
    updatedAt: Date.now() - 86_400_000 * 2,
    kind: 'preference',
    text: 'Prefers the Sahara (sienna) theme with frosted glass on.',
    importance: 0.7,
    source: 'ask',
  },
  {
    id: 'mem-2',
    ts: Date.now() - 86_400_000 * 5,
    updatedAt: Date.now() - 86_400_000 * 5,
    kind: 'fact',
    text: 'The Q3 board deck lives in ~/Documents/q3-brief.pdf.',
    importance: 0.6,
    source: 'task',
  },
  {
    id: 'mem-3',
    ts: Date.now() - 3_600_000,
    updatedAt: Date.now() - 3_600_000,
    kind: 'task',
    text: 'Completed task: build a deck from the Q3 brief.',
    importance: 0.6,
    source: 'task',
  },
];

/** AI stream plumbing for the dev/browser bridge: with no main process to push,
 *  `askAIStream` drives the registered `onAiStream` listeners on a timer so the
 *  streaming UI still animates in a plain browser tab. */
const aiStreamListeners = new Set<(e: AiStreamEvent) => void>();
const aiStreamCancels = new Map<string, () => void>();

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
  checkHotkey: async () => true,
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
  askAIStream: async (prompt) => {
    const streamId = `stream_${Math.random().toString(36).slice(2)}`;
    const answer = await mockApi.askAI(prompt);
    const words = answer.text.split(' ');
    const emit = (e: AiStreamEvent) => aiStreamListeners.forEach((cb) => cb(e));
    let i = 0;
    let cancelled = false;
    let timer = 0;
    const step = () => {
      if (cancelled) return;
      if (i < words.length) {
        emit({ streamId, type: 'delta', text: (i === 0 ? '' : ' ') + words[i] });
        i += 1;
        timer = window.setTimeout(step, 28);
      } else {
        aiStreamCancels.delete(streamId);
        emit({ streamId, type: 'done', answer });
      }
    };
    timer = window.setTimeout(step, 28);
    aiStreamCancels.set(streamId, () => {
      cancelled = true;
      window.clearTimeout(timer);
    });
    return { streamId };
  },
  cancelAiStream: async (streamId) => {
    aiStreamCancels.get(streamId)?.();
    aiStreamCancels.delete(streamId);
  },
  onAiStream: (cb) => {
    aiStreamListeners.add(cb);
    return () => {
      aiStreamListeners.delete(cb);
    };
  },
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
  setSecret: async (name, value) => {
    if (value.trim() === '') return { ok: false };
    mockSecrets.add(name);
    return { ok: true };
  },
  clearSecret: async (name) => {
    mockSecrets.delete(name);
    return { ok: true };
  },
  secretStatus: async () => Object.fromEntries([...mockSecrets].map((name) => [name, true])),
  memoryStats: async () => ({
    count: mockMemories.length,
    updatedAt: mockMemories.length === 0 ? null : Math.max(...mockMemories.map((m) => m.updatedAt)),
    embeddingSource: 'local',
  }),
  memorySearch: async (query) => {
    const q = query.trim().toLowerCase();
    const matches =
      q === ''
        ? [...mockMemories]
        : mockMemories.filter((m) => m.text.toLowerCase().includes(q));
    return matches.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  memoryForget: async (id) => {
    const before = mockMemories.length;
    mockMemories = mockMemories.filter((m) => m.id !== id);
    return { ok: mockMemories.length < before };
  },
  memoryClear: async () => {
    mockMemories = [];
    return { ok: true };
  },
  openConsole: async () => {},
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
