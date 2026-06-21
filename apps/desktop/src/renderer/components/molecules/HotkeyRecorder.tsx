import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { formatAccelerator } from '../../lib/platform.js';
import { Kbd } from '../atoms/Kbd.js';

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
        'cz-input flex cursor-pointer items-center gap-1.5 text-left',
        recording && '[box-shadow:var(--cz-ring-focus)] [&]:[border-color:var(--cz-accent)]',
      )}
    >
      {recording ? (
        <span className="text-muted">Press keys…</span>
      ) : (
        formatAccelerator(value).map((key, i) => <Kbd key={i}>{key}</Kbd>)
      )}
    </button>
  );
}
