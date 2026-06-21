import { useState, type Ref } from 'react';
import { cn } from '../../lib/cn.js';

/** Magnifier glyph drawn inline so the renderer needs no icon dependency.
 *  Lights sienna when the field is focused. */
function SearchGlyph({ focused }: { focused: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn('shrink-0', focused ? 'text-[var(--cz-accent-bright)]' : 'text-subtle')}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** The launcher's top input row: a search glyph + the query field. Implements
 *  the ARIA combobox pattern over the results listbox below it. */
export function SearchField({
  inputRef,
  value,
  onChange,
  onKeyDown,
  placeholder = 'Search actions…',
  listboxId,
  activeId,
  expanded = false,
}: {
  inputRef: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  /** id of the results listbox this combobox controls. */
  listboxId?: string;
  /** id of the active (selected) option, for aria-activedescendant. */
  activeId?: string;
  expanded?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex items-center gap-3 px-5">
      <SearchGlyph focused={focused} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        role="combobox"
        aria-label="Search actions, applications, and files"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        className="cz-search-input flex-1 bg-transparent py-4 text-lg text-fg caret-[var(--cz-accent-bright)] outline-none placeholder:text-subtle"
      />
    </div>
  );
}
