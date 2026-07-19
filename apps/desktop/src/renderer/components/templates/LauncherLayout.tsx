import { cn } from '../../lib/cn.js';

/** Frame for the launcher: centers the floating command panel near the top of
 *  the desktop. The p-10 margin is transparent window area that lets the
 *  panel's wide soft shadow render unclipped (the window is 80px wider than the
 *  design panel — see launcher-window.ts). In AI mode the panel firms its edge
 *  to the accent hairline (`cz-panel-ai`) and grows the 2px accent rail across
 *  the top. */
export function LauncherLayout({
  children,
  aiMode = false,
}: {
  children: React.ReactNode;
  /** Apply the AI-mode accent edge + top rail. */
  aiMode?: boolean;
}) {
  return (
    <div className="flex h-full items-start justify-center p-10">
      <div
        className={cn(
          'cz-panel cz-appear relative w-full overflow-hidden rounded-[var(--cz-radius-launcher)]',
          aiMode && 'cz-panel-ai',
        )}
      >
        {aiMode && (
          <div
            aria-hidden="true"
            className="h-0.5 w-full [background:linear-gradient(90deg,var(--cz-accent),var(--cz-accent-hover))]"
          />
        )}
        {children}
      </div>
    </div>
  );
}
