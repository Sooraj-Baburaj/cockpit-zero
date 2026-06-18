import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@cockpitzero/shared';

/**
 * The frameless launcher bar. All data access goes through `window.api`
 * (the typed preload bridge) — no raw IPC here.
 */
export function LauncherBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    window.api.search(query).then((r) => {
      if (active) {
        setResults(r);
        setSelected(0);
      }
    });
    return () => {
      active = false;
    };
  }, [query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      void window.api.hideLauncher();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = results[selected];
      if (hit) void window.api.runAction(hit.action.id);
    }
  }

  return (
    <div className="flex h-full items-start justify-center p-3">
      <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 shadow-2xl backdrop-blur-xl">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search actions…"
          className="w-full bg-transparent px-5 py-4 text-lg outline-none placeholder:text-white/30"
        />
        {results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto border-t border-white/10">
            {results.map((r, i) => (
              <li
                key={r.action.id}
                onMouseEnter={() => setSelected(i)}
                onClick={() => window.api.runAction(r.action.id)}
                className={`flex cursor-pointer items-center justify-between px-5 py-3 ${
                  i === selected ? 'bg-white/10' : ''
                }`}
              >
                <span>{r.action.title}</span>
                <span className="text-xs uppercase tracking-wide text-white/40">
                  {r.action.type}
                </span>
              </li>
            ))}
          </ul>
        )}
        {query !== '' && results.length === 0 && (
          <div className="border-t border-white/10 px-5 py-3 text-sm text-white/40">
            No matching actions
          </div>
        )}
      </div>
    </div>
  );
}
