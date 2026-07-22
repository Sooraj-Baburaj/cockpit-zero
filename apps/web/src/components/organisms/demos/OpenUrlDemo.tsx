'use client';

import type { Action } from '@cockpitzero/shared';
import { LauncherScene, type SceneSize } from './LauncherScene';
import { rowFromAction, systemRow, type DemoRow } from './rows';

const TARGET = {
  id: 'gh-pulls',
  title: 'Open GitHub Pull Requests',
  type: 'open-url',
  url: 'https://github.com/pulls',
} satisfies Action;

const ROWS: DemoRow[] = [
  rowFromAction(TARGET, '↗'),
  systemRow('file-pr-tpl', 'pull-request-template.md', '~/dev/acme/.github', 'File', '≡'),
  systemRow('app-pulse', 'Pulse', 'Application', 'App', '◉'),
];

/** open-url — Enter opens the target in the default browser. */
export function OpenUrlDemo({
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
      variant="dawn"
      label="Open URL"
      query="pulls"
      rows={ROWS}
      targetId={TARGET.id}
      size={size}
      frameless={frameless}
      className={className}
      playout={{
        steps: 3,
        stepMs: 650,
        render: (step) => (
          <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
            <div className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2">
              <span className="flex gap-[5px]">
                <i className="h-2 w-2 rounded-full bg-surface-3 not-italic" />
                <i className="h-2 w-2 rounded-full bg-surface-3 not-italic" />
                <i className="h-2 w-2 rounded-full bg-surface-3 not-italic" />
              </span>
              <span className="flex-1 truncate rounded-md bg-surface-2 px-2.5 py-1 font-mono text-[10.5px] leading-none text-muted">
                github.com/pulls
              </span>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {step >= 1 ? (
                <>
                  <span className="h-2.5 w-3/5 rounded bg-surface-3" />
                  <span className="h-2.5 w-4/5 rounded bg-surface-2" />
                  <span className="h-2.5 w-2/3 rounded bg-surface-2" />
                </>
              ) : (
                <>
                  <span className="h-2.5 w-3/5 rounded bg-surface-2 opacity-50" />
                  <span className="h-2.5 w-4/5 rounded bg-surface-2 opacity-30" />
                  <span className="h-2.5 w-2/3 rounded bg-surface-2 opacity-20" />
                </>
              )}
              {step >= 2 && (
                <span className="mt-0.5 self-start rounded-md border border-line-soft px-2 py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] text-accent uppercase">
                  ✓ Opened in your browser
                </span>
              )}
            </div>
          </div>
        ),
      }}
    />
  );
}
