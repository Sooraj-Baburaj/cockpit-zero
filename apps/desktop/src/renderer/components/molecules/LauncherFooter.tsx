import { cn } from '../../lib/cn.js';
import { Kbd } from '../atoms/Kbd.js';
import { modKey } from '../../lib/platform.js';

/**
 * Persistent launcher footer — a branded wordmark plus a discoverable Settings
 * entry point (the only way to reach the config/actions/workflows window besides
 * the ⌘, shortcut the launcher also handles).
 */
export function LauncherFooter({
  onOpenSettings,
  bordered = true,
}: {
  onOpenSettings: () => void;
  /** Show the hairline separator above the footer (hidden in the resting state
   *  so there's no stray line directly under the search field). */
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3.5 py-2',
        bordered && 'border-t [border-color:var(--cz-line-faint)]',
      )}
    >
      <span className="flex items-center gap-[7px] text-xs font-semibold tracking-[-0.01em] text-muted">
        <span className="grid size-4 place-items-center rounded-[5px] [background:var(--cz-accent-grad)] [box-shadow:var(--cz-glow-accent-soft)]">
          <svg
            viewBox="0 0 16 16"
            className="size-[9px]"
            fill="none"
            stroke="#fff"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8.5 1.5 3.5 9H7l-.5 5.5L12.5 7H9l-.5-5.5Z" />
          </svg>
        </span>
        CockpitZero
      </span>
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-[7px] rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-fg"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="2.25" />
          <path d="M8 1.6v1.9M8 12.5v1.9M14.4 8h-1.9M3.5 8H1.6M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3M12.5 12.5l-1.3-1.3M4.8 4.8 3.5 3.5" />
        </svg>
        <span>Settings</span>
        <span className="flex items-center gap-1">
          <Kbd>{modKey}</Kbd>
          <Kbd>,</Kbd>
        </span>
      </button>
    </div>
  );
}
