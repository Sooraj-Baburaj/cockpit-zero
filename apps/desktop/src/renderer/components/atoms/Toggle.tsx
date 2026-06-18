import { cn } from '../../lib/cn.js';

/** Themed on/off switch backed by a real checkbox for accessibility. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 select-none">
      <span className="relative inline-block h-5 w-9">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-border transition peer-checked:bg-accent" />
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition',
            checked && 'translate-x-4',
          )}
        />
      </span>
      {label && <span className="text-sm text-fg">{label}</span>}
    </label>
  );
}
