import { cn } from '../../lib/cn.js';

/** Frame for the launcher: centers the frosted command panel near the top,
 *  floating over the desktop. The p-10 margin is transparent window area that
 *  lets the panel's wide soft shadow render unclipped (the window is 80px wider
 *  than the 620px design panel — see launcher-window.ts). In AI mode the panel
 *  grows a soft accent edge (`cz-panel-ai`) and a 2px accent rail across the top. */
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
          'cz-panel cz-appear relative w-full overflow-hidden rounded-[var(--cz-radius-xl)]',
          aiMode && 'cz-panel-ai',
        )}
      >
        {aiMode && (
          <div aria-hidden="true" className="h-0.5 w-full [background:var(--cz-accent-grad)]" />
        )}
        {children}
      </div>
    </div>
  );
}
