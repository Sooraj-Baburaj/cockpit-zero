/** Frame for the launcher: centers a frosted-glass command panel near the top. */
export function LauncherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-start justify-center p-3">
      <div className="w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}
