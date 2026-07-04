import { useEffect, useRef, useState } from 'react';
import type { Config, TaskRun } from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useAppearance } from '../hooks/useAppearance.js';
import { TaskSurface } from '../components/organisms/TaskSurface.js';
import { EmptyState } from '../components/atoms/EmptyState.js';

/** The run this window shows — passed via the URL hash by the opener
 *  (`task.html#<taskId>`). */
function taskIdFromHash(): string {
  if (typeof window === 'undefined') return '';
  return decodeURIComponent(window.location.hash.replace(/^#/, ''));
}

/**
 * The dedicated task window (Phase 7). Fetches the run's current snapshot on
 * mount, then **streams** live per-step updates via the one push channel
 * (`onTaskUpdate`, the sole `ipcRenderer.on` use — registered in preload). Stop
 * halts the run; the primary CTA approves a `review` pause (the human-in-the-loop
 * gate) before anything is committed. `space` stops, `esc` dismisses, `↵`
 * approves a review.
 */
export function TaskScreen() {
  const [taskId] = useState(taskIdFromHash);
  const [config, setConfig] = useState<Config | null>(null);
  const [run, setRun] = useState<TaskRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.getConfig().then(setConfig);
    void api.taskGet(taskId).then((r) => {
      setRun(r);
      setLoaded(true);
    });
    // Stream subsequent snapshots for this run; ignore other runs' updates.
    const unsubscribe = api.onTaskUpdate((next) => {
      if (next.id === taskId) setRun(next);
    });
    rootRef.current?.focus();
    return unsubscribe;
  }, [taskId]);

  useAppearance(config?.settings.theme, config?.settings.glass);

  const active =
    run?.status === 'planning' || run?.status === 'working' || run?.status === 'review';

  /** Stop while active; otherwise dismiss the window. */
  const stop = () => {
    if (active) {
      void api.taskStop(taskId);
    } else {
      window.close();
    }
  };

  /** Primary CTA: approve a review (commits + runs the rest), or dismiss at done. */
  const primary = () => {
    if (!run) return;
    if (run.status === 'review') {
      void api.taskApprove(taskId);
    } else if (run.status === 'done') {
      window.close();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (active) void api.taskStop(taskId);
      window.close();
      return;
    }
    if (e.key === ' ' && active) {
      e.preventDefault();
      void api.taskStop(taskId);
      return;
    }
    if (e.key === 'Enter' && run?.status === 'review') {
      e.preventDefault();
      void api.taskApprove(taskId);
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="cz-window relative flex h-screen flex-col text-fg outline-none"
    >
      {run ? (
        <TaskSurface run={run} onStop={stop} onPrimary={primary} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <EmptyState
            title={loaded ? 'No such task' : 'Starting task…'}
            hint={loaded ? 'This run is no longer available.' : ''}
          />
        </div>
      )}
    </div>
  );
}
