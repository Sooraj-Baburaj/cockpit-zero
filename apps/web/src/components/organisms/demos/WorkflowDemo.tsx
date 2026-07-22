'use client';

import type { Workflow } from '@cockpitzero/shared';
import { LauncherScene, type SceneSize } from './LauncherScene';
import { rowFromWorkflow, systemRow, type DemoRow } from './rows';

const TARGET = {
  id: 'wf-standup',
  name: 'Morning standup',
  steps: ['open-board', 'join-call', 'paste-notes'],
} satisfies Workflow;

/** Display detail for each workflow step (title + the action kind it runs). */
const STEP_LABELS: Array<[string, string]> = [
  ['Open standup board', 'URL'],
  ['Join video call', 'App'],
  ["Paste yesterday's notes", 'Snippet'],
];

const ROWS: DemoRow[] = [
  rowFromWorkflow(TARGET, '⧉'),
  systemRow('file-standup', 'standup-2026-07-21.md', '~/dev/acme/notes', 'File', '≡'),
  systemRow('app-standup-widget', 'Stand', 'Application', 'App', '◉'),
];

/** workflow — Enter runs every step in sequence through the action runner. */
export function WorkflowDemo({
  size = 'default',
  frameless = false,
  className = '',
}: {
  size?: SceneSize;
  frameless?: boolean;
  className?: string;
}) {
  return (
    <LauncherScene
      variant="ion"
      label="Workflow"
      query="standup"
      rows={ROWS}
      targetId={TARGET.id}
      size={size}
      frameless={frameless}
      className={className}
      playout={{
        steps: STEP_LABELS.length + 1,
        stepMs: 620,
        render: (step, done) => (
          <div className="flex flex-col gap-1 rounded-[14px] border border-line bg-surface p-2.5">
            {STEP_LABELS.map(([title, kind], i) => {
              const state = step > i ? 'done' : step === i ? 'running' : 'pending';
              return (
                <span
                  key={title}
                  className={`flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors duration-200 ${
                    state === 'running' ? 'bg-accent-soft' : ''
                  }`}
                >
                  <i
                    className={`inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border font-mono text-[10px] leading-none not-italic ${
                      state === 'done' ? 'border-accent text-accent' : 'border-line text-muted'
                    }`}
                  >
                    {state === 'done' ? '✓' : i + 1}
                  </i>
                  <i
                    className={`flex-1 truncate text-[12.5px] leading-tight font-medium not-italic ${
                      state === 'pending' ? 'text-muted' : 'text-ink'
                    }`}
                  >
                    {title}
                  </i>
                  <i className="flex-none rounded-md border border-line-soft px-1.5 py-[3px] font-mono text-[9px] leading-none font-medium tracking-[0.08em] text-muted uppercase not-italic">
                    {kind}
                  </i>
                </span>
              );
            })}
            {(step >= STEP_LABELS.length || done) && (
              <span className="mt-0.5 border-t border-line-soft px-2 pt-2 pb-0.5 font-mono text-[10.5px] leading-none font-medium tracking-[0.06em] text-accent">
                ✓ Workflow complete · 3 steps
              </span>
            )}
          </div>
        ),
      }}
    />
  );
}
