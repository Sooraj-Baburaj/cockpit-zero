import { useState } from 'react';
import { cn } from '../../lib/cn.js';

/** Translate a keydown into an Electron accelerator string, or null if only
 *  modifier keys are held. */
function toAccelerator(e: React.KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.metaKey || e.ctrlKey) mods.push('CommandOrControl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  const key = e.key;
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) return null;

  const named = key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key;
  return [...mods, named].join('+');
}

/**
 * Records a global-hotkey accelerator. Click to arm, then press the desired
 * chord. Blur cancels. Falls back to showing the current value.
 */
export function HotkeyRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (accelerator: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={(e) => {
        if (!recording) return;
        e.preventDefault();
        const accel = toAccelerator(e);
        if (accel) {
          onChange(accel);
          setRecording(false);
        }
      }}
      className={cn(
        'w-full rounded-lg border bg-surface-2 px-3 py-2 text-left font-mono text-sm text-fg transition',
        recording ? 'border-accent text-muted' : 'border-border hover:border-accent',
      )}
    >
      {recording ? 'Press keys…' : value}
    </button>
  );
}
