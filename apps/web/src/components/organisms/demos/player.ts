'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** One scheduled beat of a demo script: wait `delay` ms, then apply `run`. */
export interface ScriptStep {
  delay: number;
  run: () => void;
}

export interface DemoPlayer {
  /** Attach to the scene's outermost element — drives play/pause on visibility. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** True when `prefers-reduced-motion` — the scene renders its static end-state. */
  reduced: boolean;
  /** True once the script has run to completion (or immediately under reduced motion). */
  done: boolean;
  /** Restart the script from the beginning. No-op under reduced motion. */
  replay: () => void;
}

/**
 * Drives a demo scene through a timed script. Auto-plays once the container is
 * scrolled into view, pauses (freezes in place) while off-screen, and can be
 * replayed. Under `prefers-reduced-motion` no timers ever run — the caller's
 * `showEndState` is applied once instead, so the scene renders a finished frame.
 *
 * `makeScript` is called lazily per run so steps may close over fresh state
 * setters; `reset` returns the scene to its first frame before a (re)play.
 */
export function useDemoPlayer(
  makeScript: () => ScriptStep[],
  reset: () => void,
  showEndState: () => void,
): DemoPlayer {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [reduced, setReduced] = useState(false);
  const [done, setDone] = useState(false);

  const script = useRef<ScriptStep[]>([]);
  const index = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const visible = useRef(false);
  const started = useRef(false);
  const finished = useRef(false);

  // Kept in refs so the IntersectionObserver effect never needs to re-bind.
  const fns = useRef({ makeScript, reset, showEndState });
  fns.current = { makeScript, reset, showEndState };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
  };

  const tick = useCallback(() => {
    const step = script.current[index.current];
    if (!step) {
      finished.current = true;
      setDone(true);
      return;
    }
    timer.current = setTimeout(() => {
      step.run();
      index.current += 1;
      if (visible.current) tick();
    }, step.delay);
  }, []);

  const replay = useCallback(() => {
    if (reduced) return;
    clear();
    fns.current.reset();
    script.current = fns.current.makeScript();
    index.current = 0;
    finished.current = false;
    started.current = true;
    setDone(false);
    if (visible.current) tick();
  }, [reduced, tick]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      fns.current.showEndState();
      finished.current = true;
      setDone(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = !!entry?.isIntersecting;
        if (visible.current) {
          if (!started.current) {
            started.current = true;
            script.current = fns.current.makeScript();
            tick();
          } else if (!finished.current && !timer.current) {
            tick(); // resume mid-script after scrolling back in
          }
        } else {
          clear(); // freeze while off-screen
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
  }, [tick]);

  return { containerRef, reduced, done, replay };
}

/** Spread a string into per-character typing steps with a human-ish cadence. */
export function typingSteps(text: string, apply: (typed: string) => void): ScriptStep[] {
  return [...text].map((_, i) => ({
    // Deterministic jitter (no Math.random) so replays feel identical.
    delay: 62 + ((i * 37) % 48),
    run: () => apply(text.slice(0, i + 1)),
  }));
}
