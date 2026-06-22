import type { Settings } from '@cockpitzero/shared';
import { Field } from '../atoms/Field.js';
import { Dropdown } from '../molecules/Dropdown.js';
import { Toggle } from '../atoms/Toggle.js';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Appearance settings: theme and the frosted-glass window translucency. */
export function AppearancePanel({
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
      <h2 className="text-lg font-semibold">Appearance</h2>

      <Field label="Theme" description="Light, dark, or follow the system.">
        <Dropdown
          ariaLabel="Theme"
          value={settings.theme}
          options={THEME_OPTIONS}
          onChange={(v) => set('theme', v as Settings['theme'])}
          className="max-w-60"
        />
      </Field>

      <Field label="Frosted glass" description="Translucent, blurred launcher and Console windows.">
        <Toggle
          checked={settings.glass}
          onChange={(v) => set('glass', v)}
          label="Enable window translucency"
        />
      </Field>
    </div>
  );
}
