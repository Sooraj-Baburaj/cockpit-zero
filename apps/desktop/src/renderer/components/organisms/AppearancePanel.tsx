import type { Settings } from '@cockpitzero/shared';
import { SegmentedControl } from '../molecules/SegmentedControl.js';
import { OptionCard } from '../molecules/OptionCard.js';
import { Toggle } from '../atoms/Toggle.js';

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'System' },
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
];

/** Appearance settings: theme, launcher translucency, and the colour controls. */
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
    <div className="max-w-[560px] space-y-5">
      <h2 className="text-[19px] font-semibold">Appearance</h2>

      <div>
        <div className="cz-label pb-[9px]">Theme</div>
        <SegmentedControl
          ariaLabel="Theme"
          value={settings.theme}
          options={THEME_OPTIONS}
          onChange={(v) => set('theme', v)}
        />
        <div className="mt-2 text-[12.5px] text-subtle">
          Switch live — light and dark are first-class.
        </div>
      </div>

      <div>
        <div className="cz-label pb-[9px]">Window</div>
        <OptionCard
          title="Launcher translucency"
          description="Frosted, blurred launcher panel. Other windows stay solid."
        >
          <Toggle
            checked={settings.glass}
            onChange={(v) => set('glass', v)}
            ariaLabel="Toggle launcher translucency"
          />
        </OptionCard>
      </div>

      <div>
        <div className="cz-label pb-[9px]">Color</div>
        <div className="space-y-2.5">
          <OptionCard
            title="Monochrome UI"
            description="Plain neutral surfaces — reserve color for content and app icons."
          >
            <Toggle
              checked={settings.monochrome}
              onChange={(v) => set('monochrome', v)}
              ariaLabel="Toggle monochrome UI"
            />
          </OptionCard>
          <OptionCard
            title="Accent on sidebar"
            description="Bring Claude-orange back to the Console's active nav item."
          >
            <Toggle
              checked={settings.sidebarAccent}
              onChange={(v) => set('sidebarAccent', v)}
              ariaLabel="Toggle sidebar accent"
            />
          </OptionCard>
          <div className="flex items-center gap-2.5 px-0.5 py-1.5">
            <span
              aria-hidden="true"
              className="h-[26px] w-[26px] shrink-0 rounded-[7px] bg-[#d97757]"
            />
            <span className="font-mono text-sm text-muted">
              #d97757 · Claude orange — reserved accent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
