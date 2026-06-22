import type { Settings } from '@cockpitzero/shared';
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

  return (
    <div className="max-w-md space-y-6">
      <h2 className="text-lg font-semibold">General</h2>

      <Field label="Global hotkey" description="Click and press the keys to summon CockpitZero.">
        <HotkeyRecorder value={settings.hotkey} onChange={(v) => set('hotkey', v)} />
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
