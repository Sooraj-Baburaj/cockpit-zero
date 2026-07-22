'use client';

import { useEffect, useState } from 'react';
import { HERO_QUERIES, type HeroQuery } from '@/lib/content';
import { Kbd, SearchIcon } from '@/components/ui';

const FALLBACK_QUERY: HeroQuery = HERO_QUERIES[0] ?? { q: '', results: [] };

/**
 * The floating hero command bar: auto-types a rotating set of queries and
 * reveals their result rows, mimicking the real launcher.
 */
export function LauncherDemo() {
  const [typed, setTyped] = useState('');
  const [qi, setQi] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduce(true);
      setTyped(FALLBACK_QUERY.q);
      setShowResults(true);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const schedule = (fn: () => void, ms: number) => {
      if (cancelled) return;
      timer = setTimeout(fn, ms);
    };

    let index = 0;
    const typeStep = (text: string) => {
      const q = (HERO_QUERIES[index] ?? FALLBACK_QUERY).q;
      if (text.length < q.length) {
        const next = q.slice(0, text.length + 1);
        setTyped(next);
        setShowResults(next.length >= q.length);
        schedule(() => typeStep(next), 70 + Math.random() * 50);
      } else {
        setShowResults(true);
        schedule(() => delStep(text), 1900);
      }
    };
    const delStep = (text: string) => {
      if (text.length > 0) {
        const next = text.slice(0, -1);
        setTyped(next);
        setShowResults(false);
        schedule(() => delStep(next), 30);
      } else {
        index = (index + 1) % HERO_QUERIES.length;
        setQi(index);
        schedule(() => typeStep(''), 400);
      }
    };

    typeStep('');
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const query = HERO_QUERIES[qi] ?? FALLBACK_QUERY;
  const results = showResults ? query.results : [];

  return (
    <div
      className="cz-float mt-[18px] w-[min(620px,95vw)] overflow-hidden rounded-[18px] border border-[var(--bar-border)] bg-[var(--bar-bg)] text-left backdrop-blur-[22px] backdrop-saturate-150 [animation:czfloat_7s_ease-in-out_infinite]"
      style={{ boxShadow: 'var(--bar-shadow)' }}
      aria-hidden
    >
      <div className="flex items-center gap-3 border-b border-line-soft px-[18px] py-[15px]">
        <SearchIcon />
        <div className="flex min-h-[23px] flex-1 items-center text-lg leading-tight font-medium text-ink">
          {!typed && <span className="text-muted">Search apps, files, actions…</span>}
          <span>{typed}</span>
          {!reduce && (
            <span className="cz-blink ml-0.5 inline-block h-5 w-0.5 bg-accent [animation:czblink_1s_step-end_infinite]" />
          )}
        </div>
        <span className="inline-flex gap-[5px]">
          <Kbd>⌘</Kbd>
          <Kbd>Space</Kbd>
        </span>
      </div>
      <div data-results className="min-h-14 p-2">
        {results.map((r) => (
          <div key={r.title} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5">
            <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-surface-3 font-mono text-[15px] leading-none font-medium text-ink">
              {r.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-tight font-medium text-ink">{r.title}</span>
              <span className="block font-mono text-[12.5px] leading-[1.3] text-muted">{r.sub}</span>
            </span>
            <span className="rounded-md border border-line-soft px-[7px] py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] uppercase text-muted">
              {r.kind}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 border-t border-line-soft px-4 py-2.5 font-mono text-[11.5px] leading-none text-muted">
        <span>↑↓ navigate</span>
        <span>↵ run</span>
        <span className="ml-auto">esc · disappear like nothing happened</span>
      </div>
    </div>
  );
}
