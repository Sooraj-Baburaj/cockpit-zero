import { useRef } from 'react';
import { cn } from '../../lib/cn.js';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Render the segment but block selection (e.g. "Bring your own" pre-provider). */
  disabled?: boolean;
  /** Native tooltip — used to explain why a segment is disabled. */
  title?: string;
}

/**
 * A single-choice segmented control: a pill track where the selected segment
 * carries the accent fill. An ARIA `radiogroup` with roving focus and
 * arrow-key navigation (skipping disabled segments) — the themed alternative to
 * a row of radios, used for `ai.modelTier`. For longer option lists prefer the
 * `Dropdown` molecule; this is for 2–3 always-visible choices.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Move selection to the next/previous enabled segment, wrapping around. */
  const step = (from: number, dir: 1 | -1) => {
    const n = options.length;
    for (let i = 1; i <= n; i++) {
      const idx = (from + dir * i + n * i) % n;
      const opt = options[idx];
      if (opt && !opt.disabled) {
        onChange(opt.value);
        refs.current[idx]?.focus();
        return;
      }
    }
  };

  const selectedIndex = options.findIndex((o) => o.value === value);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 gap-1 rounded-[var(--cz-radius-pill)] border border-border [background:var(--cz-surface-inset)] p-[3px]"
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.label}
            disabled={opt.disabled}
            title={opt.title}
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => !opt.disabled && onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                step(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                step(i, -1);
              }
            }}
            className={cn(
              'rounded-[var(--cz-radius-pill)] px-[13px] py-1.5 text-[12.5px] font-medium whitespace-nowrap transition',
              opt.disabled && 'cursor-not-allowed opacity-45',
              selected
                ? 'text-accent-fg [background:var(--cz-accent)] [box-shadow:var(--cz-shadow-sm)]'
                : !opt.disabled && 'text-muted hover:text-fg',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
