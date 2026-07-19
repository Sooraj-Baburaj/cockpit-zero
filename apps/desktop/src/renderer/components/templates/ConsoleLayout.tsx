import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn.js';
import { isMac } from '../../lib/platform.js';

/** macOS only: the window has no title bar, so this element is the drag handle. */
const DRAG: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties;

/** One labelled nav section (e.g. "Commands") and the tab ids inside it. */
export interface ConsoleNavGroup {
  label: string;
  tabs: readonly string[];
}

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

/** The CockpitZero mark — the rocket glyph from the design system. */
function MarkGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16 3c-4 4-5.5 9-5.5 14v4h11v-4c0-5-1.5-10-5.5-14Zm0 5.9a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z"
      />
      <path d="M10.5 17 6.4 22.1l4.1-1zM21.5 17l4.1 5.1-4.1-1z" />
      <path d="M13.4 21h5.2L16 27.6z" />
    </svg>
  );
}

/** Frame for the Console window: an opaque facet surface with a grouped left
 *  nav rail (`.cz-console-nav`, the sidebar-accent scope) and a scrolling
 *  content pane. */
export function ConsoleLayout({
  groups,
  active,
  onSelect,
  children,
}: {
  groups: readonly ConsoleNavGroup[];
  active: string;
  onSelect: (tab: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="cz-window flex h-screen text-fg">
      <nav
        className={cn(
          'cz-console-nav relative flex w-[var(--cz-console-nav)] shrink-0 flex-col gap-4 overflow-y-auto border-r px-3.5 pb-[18px] [border-color:var(--cz-line-faint)]',
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
        <div className="flex items-center gap-3 px-2 pb-1.5">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[var(--cz-radius-md)] text-accent-fg [background:var(--cz-accent)] [box-shadow:var(--cz-glow-chip)]">
            <MarkGlyph className="size-[24px]" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-[15px] font-semibold">
              Cockpit<span className="text-[var(--cz-accent-text)]">Zero</span>
            </span>
            <span className="mt-px block font-mono text-[11px] text-subtle">Console</span>
          </span>
        </div>

        {groups.map((group) => (
          <div key={group.label}>
            <div className="cz-label px-2 pb-1.5">{group.label}</div>
            <div className="flex flex-col gap-0.5">
              {group.tabs.map((tab) => {
                const isActive = active === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => onSelect(tab)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative flex w-full items-center gap-[11px] rounded-[9px] px-2.5 py-2 text-left text-[13.5px] font-medium capitalize transition-colors duration-110',
                      isActive
                        ? 'text-[var(--cz-accent-text)] [background:var(--cz-accent-wash)]'
                        : 'text-muted hover:bg-[var(--cz-surface-hover)] hover:text-fg',
                    )}
                  >
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
          </div>
        ))}

        <div className="mt-auto px-2 pt-2 font-mono text-[11px] text-[var(--cz-fg-faint)]">
          v1.0 · Facet
        </div>
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-[26px] py-[22px]">{children}</div>
    </div>
  );
}
