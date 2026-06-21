import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';

export interface DropdownOption {
  value: string;
  label: string;
}

/** Thin-line chevron that flips when the menu is open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0 text-subtle transition-transform duration-150', open && 'rotate-180')}
      aria-hidden="true"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/** Check glyph on the currently-selected option. */
function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[var(--cz-accent-bright)]"
      aria-hidden="true"
    >
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

/**
 * Custom single-choice dropdown — replaces the native `<select>` so the popup
 * matches the warm Sahara surfaces and themes (light/dark/glass) instead of the
 * OS-drawn menu. Implements the ARIA listbox pattern: a trigger button
 * (`aria-haspopup="listbox"`) over a `role="listbox"` of `role="option"`s, with
 * full keyboard support (arrows, Home/End, Enter/Space, Esc, type-ahead). Use
 * this everywhere a picker is needed — never a raw `<select>`.
 */
export function Dropdown({
  value,
  options,
  onChange,
  className,
  ariaLabel,
  id,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Extra classes for the relative wrapper (e.g. width / max-width). */
  className?: string;
  ariaLabel?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [flip, setFlip] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef('');
  const typedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;
  const optionId = (i: number) => `${listboxId}-opt-${i}`;
  const selected = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Close when a pointer press lands outside the component.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({
      block: 'nearest',
    });
  }, [open, active]);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    // Flip the menu above the trigger when there's little room below it.
    if (rect) setFlip(window.innerHeight - rect.bottom < 260);
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (i: number) => {
    const opt = options[i];
    if (opt) onChange(opt.value);
    close();
  };

  const typeahead = (key: string) => {
    if (typedTimer.current) clearTimeout(typedTimer.current);
    typed.current += key.toLowerCase();
    typedTimer.current = setTimeout(() => (typed.current = ''), 600);
    const match = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current));
    if (match >= 0) setActive(match);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (e.key.length === 1) typeahead(e.key);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        className="cz-input flex w-full cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={optionId(active)}
          tabIndex={-1}
          className={cn(
            'cz-panel absolute z-50 max-h-60 w-full overflow-auto rounded-lg p-1',
            flip ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === active;
            return (
              <li
                key={opt.value}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  isActive ? 'text-fg [background:var(--cz-glass-selected)]' : 'text-muted',
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
