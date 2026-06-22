import { cn } from '../../lib/cn.js';

/** Themed on/off switch backed by a real checkbox for accessibility. Pass `label`
 *  for a visible inline caption, or `ariaLabel` when the switch's name is rendered
 *  elsewhere (e.g. a settings row title or a tool card). */
export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 select-none">
      <span className="relative inline-block h-5 w-9">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={ariaLabel}
          className="peer sr-only"
        />
        <span
          className={cn(
            'absolute inset-0 rounded-full border transition',
            checked
              ? 'bg-accent [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-glow-accent-soft)]'
              : 'bg-[var(--cz-glass-3)] border-border',
          )}
        />
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition [box-shadow:0_1px_3px_rgba(58,48,42,0.28)]',
            checked && 'translate-x-4',
          )}
        />
      </span>
      {label && <span className="text-sm text-fg">{label}</span>}
    </label>
  );
}
