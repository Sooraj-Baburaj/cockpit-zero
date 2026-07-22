'use client';

import type { Action } from '@cockpitzero/shared';
import { LauncherScene, type SceneSize } from './LauncherScene';
import { rowFromAction, systemRow, type DemoRow } from './rows';

const TARGET = {
  id: 'deploy-prod',
  title: 'Deploy · Production',
  type: 'run-command',
  command: './scripts/deploy.sh',
  args: ['--prod'],
} satisfies Action;

const STAGING = {
  id: 'deploy-staging',
  title: 'Deploy · Staging',
  type: 'run-command',
  command: './scripts/deploy.sh',
  args: ['--staging'],
} satisfies Action;

const ROWS: DemoRow[] = [
  rowFromAction(TARGET, '❯'),
  rowFromAction(STAGING, '❯'),
  systemRow('file-deploy-notes', 'deploy-notes.md', '~/dev/acme/docs', 'File', '≡'),
];

const LINES = [
  { text: '$ ./scripts/deploy.sh --prod', muted: false },
  { text: '✓ Build complete (1.9s)', muted: false },
  { text: '✓ Assets uploaded · 42 files', muted: false },
  { text: '✓ Released v2.4.1', muted: false },
  { text: 'exit 0 · done in 4.2s', muted: true },
];

/** run-command — Enter executes the shell command; a terminal streams output. */
export function RunCommandDemo({
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
      label="Run Command"
      query="deploy"
      rows={ROWS}
      targetId={TARGET.id}
      size={size}
      frameless={frameless}
      className={className}
      playout={{
        steps: LINES.length,
        stepMs: 520,
        render: (step) => (
          <div className="flex min-h-[118px] flex-col gap-1.5 rounded-[14px] border border-[var(--inverse-border)] bg-[var(--inverse-bg)] p-3.5 font-mono text-[11px] leading-[1.5]">
            {LINES.slice(0, step + 1).map((line) => (
              <span
                key={line.text}
                className={
                  line.muted ? 'text-[var(--inverse-muted)]' : 'text-[var(--inverse-text)]'
                }
              >
                {line.text}
              </span>
            ))}
          </div>
        ),
      }}
    />
  );
}
