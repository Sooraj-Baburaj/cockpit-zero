'use client';

import { useRef } from 'react';
import { USE_CASES } from '@/lib/content';

/** "Tiny demos" — horizontally scroll-snapped video-placeholder cards. */
export function DemoCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('[data-uc-card]');
    const w = card ? card.getBoundingClientRect().width + 20 : 320;
    el.scrollBy({ left: dir * w, behavior: 'smooth' });
  };

  return (
    <>
      <div
        ref={trackRef}
        className="cz-scroll -mx-0.5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-0.5 pt-1 pb-[18px]"
      >
        {USE_CASES.map((u) => (
          <div
            key={u.tag}
            data-uc-card
            className="flex-[0_0_clamp(258px,78vw,330px)] snap-start overflow-hidden rounded-[22px] border border-line bg-surface"
          >
            <div className="cz-brand-grad relative" style={{ aspectRatio: '16/10' }}>
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top,rgba(0,0,0,.46),transparent 58%)' }}
              />
              <div className="absolute top-3.5 left-3.5 rounded-full border border-white/28 bg-black/42 px-[9px] py-[5px] font-mono text-[10px] leading-none font-medium tracking-[0.12em] text-white">
                DEMO
              </div>
              <div className="absolute top-1/2 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92">
                <span className="ml-[3px] h-0 w-0 border-t-8 border-b-8 border-l-[13px] border-t-transparent border-b-transparent border-l-[#1a1916]" />
              </div>
              <div className="absolute right-4 bottom-3.5 left-4 flex items-center justify-between font-mono text-[12.5px] leading-none font-medium text-white">
                <span>{u.tag}</span>
                <span className="opacity-85">{u.dur}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-[18px]">
              <h3 className="m-0 text-[17px] leading-tight font-semibold tracking-[-0.01em]">{u.title}</h3>
              <a href="#" className="flex-none text-sm leading-none font-medium text-accent">
                Watch →
              </a>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-end gap-2.5">
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Previous"
          className="inline-flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-lg text-ink transition-colors hover:bg-surface-2"
        >
          ‹
        </button>
        <button
          onClick={() => scrollBy(1)}
          aria-label="Next"
          className="inline-flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-lg text-ink transition-colors hover:bg-surface-2"
        >
          ›
        </button>
      </div>
    </>
  );
}
