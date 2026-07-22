'use client';

import type { Action } from '@cockpitzero/shared';
import { LauncherScene, type SceneSize } from './LauncherScene';
import { rowFromAction, systemRow, type DemoRow } from './rows';

const TARGET = {
  id: 'open-figma',
  title: 'Open Figma',
  type: 'open-app',
  target: '/Applications/Figma.app',
} satisfies Action;

const COMMUNITY = {
  id: 'figma-community',
  title: 'Open Figma Community',
  type: 'open-url',
  url: 'https://figma.com/community',
} satisfies Action;

const ROWS: DemoRow[] = [
  rowFromAction(TARGET, '◆'),
  rowFromAction(COMMUNITY, '↗'),
  systemRow('file-figma-export', 'figma-export.png', '~/Downloads', 'File', '≡'),
];

/** open-app — Enter launches the application. */
export function OpenAppDemo({
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
      variant="haze"
      label="Open App"
      query="figma"
      rows={ROWS}
      targetId={TARGET.id}
      size={size}
      frameless={frameless}
      className={className}
      playout={{
        steps: 3,
        stepMs: 650,
        render: (step) =>
          step === 0 ? (
            <div className="flex items-center justify-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-3 font-mono text-[15px] font-medium text-ink">
                ◆
              </span>
              <span className="font-mono text-[11px] leading-none text-muted">
                Launching Figma…
              </span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
              <div className="flex items-center gap-2.5 border-b border-line-soft px-3 py-2">
                <span className="flex gap-[5px]">
                  <i className="h-2 w-2 rounded-full bg-surface-3 not-italic" />
                  <i className="h-2 w-2 rounded-full bg-surface-3 not-italic" />
                  <i className="h-2 w-2 rounded-full bg-surface-3 not-italic" />
                </span>
                <span className="font-mono text-[10.5px] leading-none text-muted">
                  Figma — Untitled
                </span>
              </div>
              <div className="flex gap-2.5 p-3">
                <span className="flex w-9 flex-none flex-col gap-1.5">
                  <i className="h-2 rounded bg-surface-2 not-italic" />
                  <i className="h-2 rounded bg-surface-2 not-italic" />
                  <i className="h-2 rounded bg-surface-2 not-italic" />
                </span>
                <span className="relative flex h-[74px] flex-1 items-center justify-center rounded-lg bg-surface-2">
                  <i className="h-9 w-14 rounded-md border border-line bg-surface not-italic" />
                  {step >= 2 && (
                    <i className="absolute right-2 bottom-2 rounded-md border border-line-soft bg-surface px-2 py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] text-accent uppercase not-italic">
                      ✓ Ready
                    </i>
                  )}
                </span>
              </div>
            </div>
          ),
      }}
    />
  );
}
