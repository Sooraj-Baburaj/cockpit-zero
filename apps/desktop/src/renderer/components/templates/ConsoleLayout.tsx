import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { isMac } from '../../lib/platform.js';

/** macOS only: the window has no title bar, so this element is the drag handle. */
const DRAG: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties;

/** Thin-line nav glyph per Console tab. */
const NAV_GLYPH: Record<string, ReactNode> = {
  general: (
    <>
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.6v1.9M8 12.5v1.9M14.4 8h-1.9M3.5 8H1.6M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3M12.5 12.5l-1.3-1.3M4.8 4.8 3.5 3.5" />
    </>
  ),
  appearance: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2v12" />
      <path d="M8 2a6 6 0 0 1 0 12" fill="currentColor" stroke="none" />
    </>
  ),
  ai: <path d="M8 1.5 9.2 6.8 14.5 8 9.2 9.2 8 14.5 6.8 9.2 1.5 8 6.8 6.8Z" />,
  memory: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="2.2" />
      <path d="M3 4v8c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2V4" />
      <path d="M3 8c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2" />
    </>
  ),
  actions: <path d="M8.5 1.5 3.5 9H7l-.5 5.5L12.5 7H9l-.5-5.5Z" />,
  aliases: (
    <>
      <path d="M3 8h10" />
      <path d="m8 3-5 5 5 5" />
    </>
  ),
  workflows: (
    <>
      <path d="M8 2 14 5l-6 3-6-3 6-3Z" />
      <path d="m2 8 6 3 6-3" />
      <path d="m2 11 6 3 6-3" />
    </>
  ),
  routines: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.4 1.4" />
    </>
  ),
  integrations: (
    <>
      <path d="M6 2.5v3M10 2.5v3" />
      <path d="M4.5 5.5h7v2.5a3.5 3.5 0 0 1-7 0Z" />
      <path d="M8 11.5v2" />
    </>
  ),
  config: (
    <>
      <path d="M6 5 2.5 8 6 11" />
      <path d="m10 5 3.5 3L10 11" />
      <path d="M9 3 7 13" />
    </>
  ),
  account: (
    <>
      <circle cx="8" cy="5.5" r="2.8" />
      <path d="M2.8 14c.9-3.1 3-4.6 5.2-4.6s4.3 1.5 5.2 4.6" />
    </>
  ),
};

/** Display labels where the tab id doesn't capitalize cleanly (e.g. "ai" → "AI"). */
const NAV_LABEL: Record<string, string> = {
  ai: 'AI',
};

/** Frame for the Console window: a warm-white surface with a left nav rail and
 *  a scrolling content pane. */
export function ConsoleLayout({
  tabs,
  active,
  onSelect,
  children,
}: {
  tabs: readonly string[];
  active: string;
  onSelect: (tab: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="cz-window flex h-screen text-fg">
      <nav
        className={cn(
          'relative flex w-[236px] shrink-0 flex-col overflow-y-auto border-r pb-[22px] [border-color:var(--cz-line-faint)] px-4',
          // On macOS the native title bar is gone, so the traffic lights float
          // over this rail — reserve room for them above the brand.
          isMac ? 'pt-[52px]' : 'pt-[22px]',
        )}
      >
        {/* The window's drag handle (macOS has no title bar to grab). */}
        <div
          aria-hidden="true"
          className={cn('absolute inset-x-0 top-0 h-[52px]', !isMac && 'hidden')}
          style={isMac ? DRAG : undefined}
        />
        <div className="flex items-center gap-3 px-2 pb-[22px]">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[var(--cz-radius-md)] text-white [background:var(--cz-accent-grad)] [box-shadow:var(--cz-glow-accent-soft),inset_0_1px_0_rgba(255,255,255,0.4)]">
            <svg
              viewBox="0 0 16 16"
              className="size-[21px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8.5 1.5 3.5 9H7l-.5 5.5L12.5 7H9l-.5-5.5Z" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">
              CockpitZero
            </span>
            <span className="mt-px block font-mono text-[11px] text-subtle">Console · v1.0</span>
          </span>
        </div>

        <div className="flex flex-col gap-[3px]">
          {tabs.map((tab) => {
            const isActive = active === tab;
            return (
              <button
                key={tab}
                onClick={() => onSelect(tab)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-[var(--cz-radius-md)] px-3 py-2.5 text-left text-sm font-medium capitalize transition-colors duration-110',
                  isActive
                    ? 'text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)]'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {/* accent left rail on the active tab */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-[9px] bottom-[9px] left-0 w-[3px] rounded-[3px] bg-accent transition-opacity duration-180',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <svg
                  viewBox="0 0 16 16"
                  className="size-[17px] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {NAV_GLYPH[tab]}
                </svg>
                {NAV_LABEL[tab] ?? tab}
              </button>
            );
          })}
        </div>

        <div className="mt-auto border-t pt-3 [border-color:var(--cz-line-faint)]">
          <div className="px-2 font-mono text-[10px] tracking-[var(--cz-tracking-label)] text-subtle uppercase">
            Cockpit Zero
          </div>
        </div>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-[30px] py-[26px]">{children}</div>
    </div>
  );
}
