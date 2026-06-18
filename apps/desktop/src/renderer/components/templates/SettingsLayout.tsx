import { cn } from '../../lib/cn.js';

/** Frame for the settings window: opaque themed background, header, and tabs. */
export function SettingsLayout({
  tabs,
  active,
  onSelect,
  children,
}: {
  tabs: string[];
  active: string;
  onSelect: (tab: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">CockpitZero</h1>
          <p className="text-sm text-muted">Settings</p>
        </header>

        <nav className="mb-6 flex gap-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onSelect(tab)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm capitalize transition',
                active === tab
                  ? 'border-accent text-fg'
                  : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {tab}
            </button>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
