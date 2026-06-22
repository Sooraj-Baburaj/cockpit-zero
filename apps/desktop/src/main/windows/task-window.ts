import { app, BrowserWindow } from 'electron';
import { TASK_UPDATE_CHANNEL } from '@cockpitzero/shared';
import type { TaskRun } from '@cockpitzero/shared';
import { readConfig } from '../infra/store.js';
import { loadEntry, secureWebPreferences } from './internal.js';

/**
 * The agent task window (Phase 7) — a dedicated surface that streams a `taskRun`'s
 * progress (the `ai-task.html` checklist). It mirrors the digest window's chrome
 * (a real, closable, frosted window) but is the recipient of the one **push**
 * channel: the agent service forwards every snapshot here via {@link sendTaskUpdate}
 * → `webContents.send`, which the renderer subscribes to with `onTaskUpdate`.
 */

let taskWindow: BrowserWindow | null = null;

/** Opaque fallback background (warm linen) when frosted glass is off. */
const SOLID_BG = '#faf5ee';

const TASK_WIDTH = 760;
const TASK_HEIGHT = 720;

/** Bring the app to the foreground (the launcher runs dock-hidden on macOS). */
function revealApp(): void {
  if (process.platform === 'darwin') {
    void app.dock?.show();
    app.focus({ steal: true });
  }
}

/**
 * Open (or focus) the task window for a run. When it's already open we reload it
 * with the new task id so it re-fetches that run (the renderer reads the id from
 * the URL hash, calls `taskGet` for the snapshot, then streams via `onTaskUpdate`).
 */
export function openTaskWindow(taskId: string): void {
  if (taskWindow && !taskWindow.isDestroyed()) {
    loadEntry(taskWindow, 'task', taskId);
    revealApp();
    taskWindow.show();
    taskWindow.focus();
    return;
  }

  const glass = readConfig().settings.glass;
  const darwin = process.platform === 'darwin';
  const win32 = process.platform === 'win32';
  const frosted = glass && (darwin || win32);

  taskWindow = new BrowserWindow({
    width: TASK_WIDTH,
    height: TASK_HEIGHT,
    show: false,
    title: 'CockpitZero — Task',
    backgroundColor: frosted ? '#00000000' : SOLID_BG,
    ...(glass && darwin ? { vibrancy: 'under-window' as const } : {}),
    ...(glass && win32 ? { backgroundMaterial: 'acrylic' as const } : {}),
    webPreferences: secureWebPreferences,
  });

  taskWindow.once('ready-to-show', () => {
    revealApp();
    taskWindow?.show();
    taskWindow?.focus();
  });

  taskWindow.on('closed', () => {
    taskWindow = null;
    if (process.platform === 'darwin') app.dock?.hide();
  });

  loadEntry(taskWindow, 'task', taskId);
}

/**
 * Push a task snapshot to the open task window (the agent service's `emit` sink).
 * A no-op when the window isn't open — the renderer catches up via `taskGet` on
 * mount, so a missed early frame never loses state.
 */
export function sendTaskUpdate(run: TaskRun): void {
  if (taskWindow && !taskWindow.isDestroyed()) {
    taskWindow.webContents.send(TASK_UPDATE_CHANNEL, run);
  }
}
