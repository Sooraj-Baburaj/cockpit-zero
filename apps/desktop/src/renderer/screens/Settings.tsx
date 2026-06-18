import { useEffect, useState } from 'react';
import type { Config } from '@cockpitzero/shared';

/** Settings window. Reads/writes config exclusively through `window.api`. */
export function Settings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.api.getConfig().then(setConfig);
  }, []);

  if (!config) {
    return <div className="p-8 text-white/60">Loading…</div>;
  }

  async function save(next: Config) {
    setSaving(true);
    const saved = await window.api.setConfig(next);
    setConfig(saved);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl p-8 text-neutral-100">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <section className="mb-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-white/60">Global hotkey</span>
          <input
            value={config.settings.hotkey}
            onChange={(e) =>
              setConfig({ ...config, settings: { ...config.settings, hotkey: e.target.value } })
            }
            className="w-full rounded-lg border border-white/15 bg-neutral-800 px-3 py-2 outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-white/60">Theme</span>
          <select
            value={config.settings.theme}
            onChange={(e) =>
              setConfig({
                ...config,
                settings: { ...config.settings, theme: e.target.value as Config['settings']['theme'] },
              })
            }
            className="w-full rounded-lg border border-white/15 bg-neutral-800 px-3 py-2 outline-none"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium">Actions ({config.actions.length})</h2>
        <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
          {config.actions.length === 0 && (
            <li className="px-4 py-3 text-sm text-white/40">No actions yet.</li>
          )}
          {config.actions.map((a) => (
            <li key={a.id} className="flex justify-between px-4 py-3">
              <span>{a.title}</span>
              <span className="text-xs uppercase text-white/40">{a.type}</span>
            </li>
          ))}
        </ul>
      </section>

      <button
        disabled={saving}
        onClick={() => save(config)}
        className="rounded-lg bg-white px-4 py-2 font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
