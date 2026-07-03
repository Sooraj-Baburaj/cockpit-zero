import { useState } from 'react';
import { api } from '../../lib/api.js';
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
 *
 * Before committing a chord we ask the main process whether it's actually free
 * (`checkHotkey`) — a combo already claimed by another app can't be registered,
 * so we reject it inline rather than silently dropping the binding on save.
 */
export function HotkeyRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (accelerator: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    const accel = toAccelerator(e);
    if (!accel) return;

    // Re-selecting the current binding is always fine; otherwise probe availability.
    const available = accel === value || (await api.checkHotkey(accel));
    if (available) {
      setConflict(null);
      onChange(accel);
      setRecording(false);
    } else {
      // Stay armed so the user can immediately try a different chord.
      setConflict(accel);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => {
          setConflict(null);
          setRecording(true);
        }}
        onBlur={() => {
          setRecording(false);
          setConflict(null);
        }}
        onKeyDown={onKeyDown}
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
      {conflict && (
        <p className="text-[12px] text-[var(--cz-danger)]">
          {formatAccelerator(conflict).join(' ')} is already in use — try another combination.
        </p>
      )}
    </div>
  );
}
