/** Frame for the launcher: centers a warm-white command panel near the top,
 *  floating over the desktop with barely-there elevation. */
export function LauncherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-start justify-center p-3">
      <div className="cz-panel cz-appear relative w-full overflow-hidden rounded-[var(--cz-radius-xl)]">
        {children}
      </div>
    </div>
  );
}
