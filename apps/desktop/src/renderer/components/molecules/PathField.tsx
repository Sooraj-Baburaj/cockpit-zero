import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { Input } from '../atoms/Input.js';

/**
 * A text input with filesystem path autocomplete — used for the open-app target
 * field so typing `/Applications/Vis` suggests `/Applications/Visual Studio
 * Code.app`. Suggestions come from the main process (`completePath`); ↑/↓ move
 * the highlight, ↵/Tab accept it, Esc dismisses, and clicking fills the value.
 */
export function PathField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Suppress the lookup for the value we just programmatically filled (on accept),
  // so accepting a suggestion doesn't immediately reopen the list.
  const skip = useRef<string | null>(null);

  useEffect(() => {
    if (skip.current === value) {
      skip.current = null;
      return;
    }
    let alive = true;
    void api.completePath(value).then((results) => {
      if (!alive) return;
      // Don't suggest the single entry the field already contains exactly.
      const filtered = results.filter((r) => r !== value);
      setSuggestions(filtered);
      setActive(0);
      setOpen(filtered.length > 0);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  const accept = (suggestion: string) => {
    skip.current = suggestion;
    onChange(suggestion);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      accept(suggestions[active]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        className="font-mono"
        autoComplete="off"
        spellCheck={false}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 [box-shadow:var(--cz-shadow-md)]">
          {suggestions.map((suggestion, i) => (
            <li
              key={suggestion}
              // mousedown (not click) so we fill before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                accept(suggestion);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'cursor-pointer truncate px-3 py-1.5 font-mono text-sm',
                i === active ? '[background:var(--cz-glass-selected)] text-fg' : 'text-muted',
              )}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
