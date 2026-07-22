'use client';

import { useRef } from 'react';
import {
  OpenAppDemo,
  OpenUrlDemo,
  RunCommandDemo,
  SnippetDemo,
  WorkflowDemo,
} from '@/components/organisms/demos';

/**
 * "Tiny demos" — a horizontally scroll-snapped rail of live launcher demos,
 * one per action type. These are the real scripted scenes (compact size), not
 * video placeholders: each plays when scrolled into view and replays on ↻.
 */
const DEMOS: Array<{
  tag: string;
  title: string;
  Demo: React.ComponentType<{ size?: 'compact'; frameless?: boolean }>;
}> = [
  { tag: 'Open URL', title: 'Any page, one Enter.', Demo: OpenUrlDemo },
  { tag: 'Open App', title: 'Faster than the dock.', Demo: OpenAppDemo },
  { tag: 'Run Command', title: 'Scripts without a terminal.', Demo: RunCommandDemo },
  { tag: 'Snippet', title: 'Paste it everywhere.', Demo: SnippetDemo },
  { tag: 'Workflow', title: 'One Enter. Three things happen.', Demo: WorkflowDemo },
];

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
        {DEMOS.map(({ tag, title, Demo }) => (
          <div
            key={tag}
            data-uc-card
            className="flex flex-[0_0_clamp(272px,80vw,340px)] snap-start flex-col overflow-hidden rounded-[22px] border border-line bg-surface"
          >
            <Demo size="compact" frameless />
            <div className="flex items-center justify-between gap-3 p-[18px]">
              <h3 className="m-0 text-[16px] leading-tight font-semibold tracking-[-0.01em]">
                {title}
              </h3>
              <span className="flex-none rounded-md border border-line-soft px-1.5 py-1 font-mono text-[9.5px] leading-none font-medium tracking-[0.08em] uppercase text-muted">
                {tag}
              </span>
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
