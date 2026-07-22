export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-line-soft bg-surface-3 px-2 py-[3px] font-mono text-xs font-medium text-muted">
      {children}
    </kbd>
  );
}
