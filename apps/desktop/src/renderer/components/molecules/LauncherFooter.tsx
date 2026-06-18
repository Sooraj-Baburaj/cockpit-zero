import { Kbd } from '../atoms/Kbd.js';

/**
 * Persistent launcher footer — a brand label plus a discoverable Settings entry
 * point (the only way to reach the config/actions/workflows window besides the
 * ⌘, shortcut the launcher also handles).
 */
export function LauncherFooter({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2">
      <span className="text-xs font-medium text-subtle">CockpitZero</span>
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-fg"
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
        <Kbd>⌘,</Kbd>
      </button>
    </div>
  );
}
