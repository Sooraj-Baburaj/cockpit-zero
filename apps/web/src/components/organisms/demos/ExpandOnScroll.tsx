'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-driven grow-and-pin: a tall scroll track pins its child in the
 * viewport center (sticky) while the child scales from small to full size over
 * the first stretch of scrolling, then holds full-size until the track ends
 * and the section scrolls away. Same rAF-on-scroll pattern as StickyFeatures;
 * under `prefers-reduced-motion` the child simply renders full-size.
 */
export function ExpandOnScroll({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      return;
    }
    let raf = 0;
    const compute = () => {
      raf = 0;
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      // Start growing while the track is still entering (a ~35%-viewport lead)
      // and reach full size 45% of the way through, then hold until it unpins.
      const lead = window.innerHeight * 0.35;
      const p = Math.max(0, Math.min(1, (lead - r.top) / (lead + total * 0.45)));
      setProgress(p);
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

  // Ease-out so the growth settles gently into the pin.
  const eased = 1 - Math.pow(1 - progress, 3);
  const scale = reduced ? 1 : 0.62 + 0.38 * eased;

  return (
    <div ref={trackRef} className={`h-[220vh] ${className}`}>
      <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden px-4">
        <div
          className="w-[min(80vw,1080px)] max-sm:w-[min(92vw,1080px)] will-change-transform"
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
