import { cn } from '../../lib/cn.js';
import { Kbd } from '../atoms/Kbd.js';
import { modKey } from '../../lib/platform.js';

/** One keyboard hint shown in the footer: a keycap + its label. */
export interface FooterHint {
  /** The keycap glyph(s), e.g. "↵" or `${modKey}↵`. */
  keys: string;
  label: string;
}

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

/** The branded wordmark button — always bottom-left; opens the Console. */
function Wordmark({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-1.5 py-1 font-mono text-xs font-semibold text-muted transition hover:text-fg"
    >
      <span className="grid size-5 place-items-center rounded-[var(--cz-radius-sm)] text-accent-fg [background:var(--cz-accent)] [box-shadow:var(--cz-glow-chip)]">
        <MarkGlyph className="size-3.5" />
      </span>
      <span>
        Cockpit<span className="text-[var(--cz-accent-text)]">Zero</span>
      </span>
    </button>
  );
}

/**
 * Persistent launcher footer: the wordmark (a Console entry point) on the
 * left; contextual keyboard hints plus the ⌘, Console shortcut on the right.
 */
export function LauncherFooter({
  onOpenConsole,
  bordered = true,
  hints,
}: {
  onOpenConsole: () => void;
  /** Show the hairline separator above the footer (hidden in the resting state
   *  so there's no stray line directly under the search field). */
  bordered?: boolean;
  /** Contextual keyboard hints — shown before the Console shortcut. */
  hints?: FooterHint[];
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3.5 py-2.5',
        bordered && 'border-t [border-color:var(--cz-line-faint)]',
      )}
    >
      <Wordmark onClick={onOpenConsole} />
      <div className="flex items-center gap-3.5">
        {hints?.map((hint) => (
          <span key={hint.label} className="flex items-center gap-[7px] text-xs text-muted">
            <Kbd>{hint.keys}</Kbd>
            {hint.label}
          </span>
        ))}
        <button
          type="button"
          onClick={onOpenConsole}
          className="flex items-center gap-[7px] rounded-md px-1.5 py-1 text-xs text-muted transition hover:text-fg"
        >
          <span className="flex items-center gap-1">
            <Kbd>{modKey}</Kbd>
            <Kbd>,</Kbd>
          </span>
          Console
        </button>
      </div>
    </div>
  );
}
