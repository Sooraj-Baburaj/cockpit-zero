import type { Settings } from '@cockpitzero/shared';
import { Field } from '../atoms/Field.js';
import { Select } from '../atoms/Select.js';
import { Toggle } from '../atoms/Toggle.js';
import { HotkeyRecorder } from '../molecules/HotkeyRecorder.js';

/** General settings: global hotkey, theme, and launch/telemetry toggles. */
export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="space-y-6">
      <Field label="Global hotkey" description="Click and press the keys to summon CockpitZero.">
        <HotkeyRecorder value={settings.hotkey} onChange={(v) => set('hotkey', v)} />
      </Field>

      <Field label="Theme">
        <Select
          value={settings.theme}
          onChange={(e) => set('theme', e.target.value as Settings['theme'])}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </Select>
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
