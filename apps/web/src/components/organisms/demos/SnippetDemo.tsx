'use client';

import type { Action } from '@cockpitzero/shared';
import { LauncherScene, type SceneSize } from './LauncherScene';
import { rowFromAction, systemRow, type DemoRow } from './rows';

const TARGET = {
  id: 'meeting-link',
  title: 'Paste meeting link',
  type: 'snippet',
  content: 'https://cal.com/you/30min',
} satisfies Action;

const MEET = {
  id: 'google-meet',
  title: 'Open Google Meet',
  type: 'open-url',
  url: 'https://meet.google.com',
} satisfies Action;

const ROWS: DemoRow[] = [
  rowFromAction(TARGET, '❐'),
  rowFromAction(MEET, '↗'),
  systemRow('file-meeting-notes', 'meeting-notes.md', '~/dev/acme/docs', 'File', '≡'),
];

/** snippet — Enter copies the content and pastes it where you were typing. */
export function SnippetDemo({
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
      label="Snippet"
      query="meet"
      rows={ROWS}
      targetId={TARGET.id}
      size={size}
      frameless={frameless}
      className={className}
      playout={{
        steps: 3,
        stepMs: 700,
        render: (step) => (
          <div className="flex flex-col items-start gap-2.5">
            <span className="rounded-full border border-line bg-surface px-3 py-2 font-mono text-[10.5px] leading-none font-medium tracking-[0.06em] text-ink">
              ✓ Copied to clipboard
            </span>
            {step >= 1 && (
              <div className="czd-rise w-full rounded-[14px] border border-line bg-surface p-3">
                <span className="mb-2 block font-mono text-[10px] leading-none font-medium tracking-[0.1em] text-muted uppercase">
                  Message · reply
                </span>
                <span className="block rounded-lg bg-surface-2 px-2.5 py-2 text-[12.5px] leading-[1.5] text-ink">
                  Does tomorrow work?{' '}
                  <span
                    className={`rounded px-0.5 font-mono text-[11.5px] transition-colors duration-500 ${
                      step >= 2 ? 'bg-transparent text-accent' : 'bg-accent-soft text-ink'
                    }`}
                  >
                    {TARGET.content}
                  </span>
                </span>
              </div>
            )}
          </div>
        ),
      }}
    />
  );
}
