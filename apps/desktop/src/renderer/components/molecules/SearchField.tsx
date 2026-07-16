import { useState, type Ref } from 'react';
import { cn } from '../../lib/cn.js';
import { Sparkle } from '../atoms/Sparkle.js';

/** Magnifier glyph drawn inline so the renderer needs no icon dependency.
 *  Lights accent-blue when the field is focused. */
function SearchGlyph({ focused }: { focused: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'shrink-0 transition-colors duration-110',
        focused ? 'text-[var(--cz-accent-bright)]' : 'text-subtle',
      )}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** The launcher's top input row: a leading glyph + the query field, with an
 *  optional trailing slot (the "AI mode" pill). In AI mode the magnifier is
 *  swapped for the spark. Implements the ARIA combobox pattern over the list
 *  below it. */
export function SearchField({
  inputRef,
  value,
  onChange,
  onKeyDown,
  placeholder = 'Search actions…',
  listboxId,
  activeId,
  expanded = false,
  glyph = 'search',
  trailing,
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
  /** Leading icon: the magnifier (default) or the AI spark (AI mode). */
  glyph?: 'search' | 'spark';
  /** Optional element at the right of the row (e.g. the "AI mode" pill). */
  trailing?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex items-center gap-4 px-6">
      {glyph === 'spark' ? (
        <Sparkle className="size-6 shrink-0 text-[var(--cz-accent)]" pair />
      ) : (
        <SearchGlyph focused={focused} />
      )}
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
        className="cz-search-input flex-1 bg-transparent py-[18px] text-[length:var(--cz-text-query)] font-normal tracking-[-0.01em] text-fg caret-[var(--cz-accent)] outline-none placeholder:text-subtle"
      />
      {trailing}
    </div>
  );
}
