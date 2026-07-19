import { useEffect, useState } from 'react';
import type { Settings } from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { OptionCard } from '../molecules/OptionCard.js';
import { Toggle } from '../atoms/Toggle.js';
import { HotkeyRecorder } from '../molecules/HotkeyRecorder.js';

/** General settings: global hotkey and launch/telemetry toggles. */
export function ConsolePanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  // Wayland can't deliver Electron global shortcuts at all, and elsewhere the
  // chord may be claimed by another app — either way, tell the user instead of
  // leaving a hotkey that silently never fires.
  const [hotkeyIssue, setHotkeyIssue] = useState<'wayland' | 'unregistered' | null>(null);
  useEffect(() => {
    void api.hotkeyStatus().then(({ registered, wayland }) => {
      setHotkeyIssue(wayland ? 'wayland' : registered ? null : 'unregistered');
    });
  }, []);

  return (
    <div className="max-w-[560px] space-y-3">
      <h2 className="pb-2 text-[19px] font-semibold">General</h2>

      <div className="space-y-2 rounded-[var(--cz-radius-lg)] border border-border bg-surface-2 px-4 py-[13px]">
        <div>
          <div className="text-sm font-semibold text-fg">Global hotkey</div>
          <div className="mt-0.5 text-[12.5px] text-subtle">
            Summon CockpitZero from anywhere — click and press the keys.
          </div>
        </div>
        <HotkeyRecorder value={settings.hotkey} onChange={(v) => set('hotkey', v)} />
        {hotkeyIssue && (
          <p className="text-[12.5px] [color:var(--cz-warn)]">
            {hotkeyIssue === 'wayland' ? (
              <>
                Wayland doesn’t let apps register system-wide hotkeys. In your desktop’s keyboard
                settings, bind a shortcut that runs{' '}
                <code className="font-mono">cockpitzero --toggle</code> — it summons the bar the
                same way.
              </>
            ) : (
              <>This hotkey couldn’t be registered — another app may already use it.</>
            )}
          </p>
        )}
      </div>

      <OptionCard title="Launch at login">
        <Toggle
          checked={settings.launchAtLogin}
          onChange={(v) => set('launchAtLogin', v)}
          ariaLabel="Toggle launch at login"
        />
      </OptionCard>
      <OptionCard
        title="Share usage analytics"
        description="Anonymous counts only — never your queries or content."
      >
        <Toggle
          checked={settings.telemetryEnabled}
          onChange={(v) => set('telemetryEnabled', v)}
          ariaLabel="Toggle usage analytics"
        />
      </OptionCard>
    </div>
  );
}
