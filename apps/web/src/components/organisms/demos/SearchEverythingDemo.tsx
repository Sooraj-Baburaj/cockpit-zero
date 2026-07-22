'use client';

import type { Action } from '@cockpitzero/shared';
import { LauncherScene, type SceneSize } from './LauncherScene';
import { rowFromAction, systemRow, type DemoRow } from './rows';

/**
 * The "why it exists" demo: one bar over apps, files, and actions — typed with
 * a typo ("chrme"), because the real fzf ranking still finds Chrome. Three
 * wrong letters are usually enough.
 */
const WEB_STORE = {
  id: 'chrome-web-store',
  title: 'Open Chrome Web Store',
  type: 'open-url',
  url: 'https://chromewebstore.google.com',
} satisfies Action;

const ROWS: DemoRow[] = [
  systemRow('app-chrome', 'Google Chrome', 'Application', 'App', '◉'),
  systemRow('file-bookmarks', 'chrome-bookmarks.html', '~/Downloads', 'File', '≡'),
  rowFromAction(WEB_STORE, '↗'),
];

export function SearchEverythingDemo({
  size = 'large',
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
      label="Fuzzy Search"
      query="chrme"
      rows={ROWS}
      targetId="app-chrome"
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
              <span className="font-mono text-[10.5px] leading-none text-muted">
                Google Chrome — New Tab
              </span>
            </div>
            <div className="flex flex-col items-center gap-2.5 px-3 py-5">
              <span
                className={`h-8 w-8 rounded-full transition-colors duration-300 ${
                  step >= 1 ? 'bg-surface-3' : 'bg-surface-2'
                }`}
              />
              <span className="h-2.5 w-3/5 rounded-full bg-surface-2" />
              {step >= 2 && (
                <span className="mt-1 rounded-md border border-line-soft px-2 py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] text-accent uppercase">
                  ✓ Launched — typo and all
                </span>
              )}
            </div>
          </div>
        ),
      }}
    />
  );
}
