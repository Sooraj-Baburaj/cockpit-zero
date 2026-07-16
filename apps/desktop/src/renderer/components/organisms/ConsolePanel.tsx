import { useEffect, useState } from 'react';
import type { Settings } from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { Field } from '../atoms/Field.js';
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
    <div className="max-w-md space-y-6">
      <h2 className="text-lg font-semibold">General</h2>

      <Field label="Global hotkey" description="Click and press the keys to summon CockpitZero.">
        <HotkeyRecorder value={settings.hotkey} onChange={(v) => set('hotkey', v)} />
        {hotkeyIssue && (
          <p className="mt-1.5 text-[12.5px] [color:var(--cz-warn)]">
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
      </Field>

      <Toggle
        checked={settings.launchAtLogin}
        onChange={(v) => set('launchAtLogin', v)}
        label="Launch at login"
      />
      <Toggle
        checked={settings.telemetryEnabled}
        onChange={(v) => set('telemetryEnabled', v)}
        label="Share anonymous usage telemetry"
      />
    </div>
  );
}
