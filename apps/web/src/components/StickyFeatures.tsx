'use client';

import { useEffect, useRef, useState } from 'react';
import { STEPS, type Step } from '@/lib/content';
import { Eyebrow, MediaPlaceholder } from '@/components/ui';

const FALLBACK_STEP: Step = STEPS[0] ?? { n: '', tag: '', title: '', body: '', media: '' };

/**
 * "How it works" — a scroll-pinned stepper on desktop (340vh scroll distance,
 * one step per quarter) and a plain stacked list on mobile.
 */
export function StickyFeatures() {
  const sectionRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const sec = sectionRef.current;
      if (!sec || window.innerWidth < 860) return;
      const r = sec.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.max(0, Math.min(0.9999, -r.top / total));
      setStep(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    compute();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const active = STEPS[step] ?? FALLBACK_STEP;
  const progress = (((step + 1) / STEPS.length) * 100).toFixed(2);

  return (
    <>
      <section ref={sectionRef} className="relative hidden h-[340vh] px-4 sm:px-10 desk:block">
        <div className="sticky top-0 flex h-screen items-center">
          <div className="mx-auto grid w-full max-w-[1160px] grid-cols-2 items-center gap-[clamp(32px,5vw,84px)]">
            <div>
              <Eyebrow>How it works</Eyebrow>
              <div className="mt-4 mb-2 flex items-baseline gap-[13px]">
                <span className="font-mono text-[15px] leading-none font-medium text-accent">{active.n}</span>
                <span className="font-mono text-[12.5px] leading-none font-medium tracking-[0.1em] uppercase text-muted">
                  {active.tag}
                </span>
              </div>
              <h2 className="m-0 min-h-[2.1em] text-[clamp(30px,3.4vw,46px)] leading-[1.08] font-semibold tracking-[-0.02em]">
                {active.title}
              </h2>
              <p className="mt-3.5 mb-0 min-h-[5.4em] text-[clamp(16px,1.8vw,19px)] leading-[1.6] text-muted">
                {active.body}
              </p>
              <div className="mt-[26px] h-[3px] overflow-hidden rounded-sm bg-surface-3">
                <div
                  className="h-full rounded-sm bg-accent transition-[width] duration-[450ms] ease-[cubic-bezier(.16,.84,.44,1)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-4">
                {STEPS.map((st) => (
                  <span
                    key={st.n}
                    className="font-mono text-[11.5px] leading-none font-medium tracking-[0.06em] text-muted"
                  >
                    {st.n} {st.tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative">
              <MediaPlaceholder
                label={active.media}
                aspect="4/3"
                className="rounded-[clamp(16px,2vw,26px)] border border-line"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-10 desk:hidden">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 mb-[30px] text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">
          One hotkey, everything under it
        </h2>
        <div className="flex flex-col gap-5">
          {STEPS.map((st) => (
            <div key={st.n} data-reveal className="overflow-hidden rounded-[20px] border border-line bg-surface">
              <MediaPlaceholder label={st.media} aspect="16/9" />
              <div className="p-5">
                <div className="mb-2 flex items-baseline gap-[11px]">
                  <span className="font-mono text-sm leading-none font-medium text-accent">{st.n}</span>
                  <span className="font-mono text-[11.5px] leading-none font-medium tracking-[0.1em] uppercase text-muted">
                    {st.tag}
                  </span>
                </div>
                <h3 className="m-0 mb-2 text-[22px] leading-[1.15] font-semibold tracking-[-0.01em]">{st.title}</h3>
                <p className="m-0 text-[15px] leading-[1.55] text-muted">{st.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
