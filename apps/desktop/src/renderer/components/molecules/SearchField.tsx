import type { Ref } from 'react';

/** Magnifier glyph drawn inline so the renderer needs no icon dependency. */
function SearchGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0 text-subtle"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** The launcher's top input row: a search glyph + the query field. */
export function SearchField({
  inputRef,
  value,
  onChange,
  onKeyDown,
  placeholder = 'Search actions…',
}: {
  inputRef: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5">
      <SearchGlyph />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="flex-1 bg-transparent py-4 text-lg text-fg outline-none placeholder:text-subtle"
      />
    </div>
  );
}
