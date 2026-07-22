'use client';

import { useState } from 'react';
import { DemoBackdrop } from './Backdrop';
import { useDemoPlayer, typingSteps, type ScriptStep } from './player';

/**
 * The AI Cockpit memory demo: the user asks the assistant to pick up
 * yesterday's work, recalled memories surface as chips, and the reply streams
 * in already knowing the context. Scripted like every other demo — no model,
 * no network; the AI window is opaque per Facet (glass is launcher-only).
 */

const QUESTION = 'continue what I was doing yesterday';

const MEMORIES = ['Yesterday · editing the landing-page hero', 'Project · cockpit-site in VS Code'];

const REPLY =
  'Reopening cockpit-site in VS Code and starting the dev server — you stopped at the hero section.';

const REPLY_WORDS = REPLY.split(' ');

export function MemoryDemo({
  frameless = false,
  className = '',
}: {
  frameless?: boolean;
  className?: string;
}) {
  const [typed, setTyped] = useState('');
  const [recalled, setRecalled] = useState(0);
  const [streamed, setStreamed] = useState(0);

  const { containerRef, reduced, done, replay } = useDemoPlayer(
    () => {
      const steps: ScriptStep[] = [];
      const typing = typingSteps(QUESTION, setTyped);
      if (typing[0]) typing[0].delay += 600;
      steps.push(...typing);
      steps.push({ delay: 450, run: () => setRecalled(1) });
      steps.push({ delay: 380, run: () => setRecalled(2) });
      for (let w = 1; w <= REPLY_WORDS.length; w++) {
        steps.push({ delay: w === 1 ? 550 : 85, run: () => setStreamed(w) });
      }
      steps.push({ delay: 900, run: () => undefined }); // settle before "done"
      return steps;
    },
    () => {
      setTyped('');
      setRecalled(0);
      setStreamed(0);
    },
    () => {
      setTyped(QUESTION);
      setRecalled(MEMORIES.length);
      setStreamed(REPLY_WORDS.length);
    },
  );

  const streaming = streamed > 0 && streamed < REPLY_WORDS.length;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${frameless ? '' : 'rounded-[22px] border border-line'} ${className}`}
    >
      <DemoBackdrop variant="haze" />

      <div
        aria-hidden
        className="relative flex aspect-[4/5] flex-col items-center px-4 pt-[12%] sm:aspect-[16/10] sm:pt-[7%]"
      >
        <span className="absolute top-3.5 left-3.5 rounded-md border border-line-soft bg-[var(--bar-bg)] px-[7px] py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] uppercase text-muted backdrop-blur-md">
          AI Cockpit · Memory
        </span>

        <div className="czd-pop w-[min(480px,94%)] overflow-hidden rounded-[18px] border border-line bg-surface shadow-none">
          <div className="flex items-center gap-2.5 border-b border-line-soft px-3.5 py-2.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[13px] leading-none font-medium text-ink">AI Cockpit</span>
            <span className="ml-auto rounded-md border border-line-soft px-1.5 py-[3px] font-mono text-[9px] leading-none font-medium tracking-[0.08em] uppercase text-muted">
              Memory on
            </span>
          </div>

          <div className="flex flex-col gap-3 p-3.5">
            <div className="self-end rounded-[12px] rounded-br-[4px] bg-surface-2 px-3 py-2 text-[13px] leading-[1.45] text-ink">
              {typed || <span className="text-muted">…</span>}
              {!reduced && typed.length < QUESTION.length && (
                <span className="cz-blink ml-0.5 inline-block h-3.5 w-0.5 bg-accent align-middle [animation:czblink_1s_step-end_infinite]" />
              )}
            </div>

            {recalled > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {MEMORIES.slice(0, recalled).map((m) => (
                  <span
                    key={m}
                    className="czd-rise rounded-md border border-accent/40 bg-accent-soft px-2 py-1 font-mono text-[10px] leading-[1.4] text-ink"
                  >
                    ◈ {m}
                  </span>
                ))}
              </div>
            )}

            <div className="min-h-[3.4em] text-[13px] leading-[1.55] text-ink">
              {streamed > 0 && (
                <>
                  {REPLY_WORDS.slice(0, streamed).join(' ')}
                  {streaming && !reduced && (
                    <span className="cz-blink ml-0.5 inline-block h-3.5 w-0.5 bg-accent align-middle [animation:czblink_1s_step-end_infinite]" />
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3.5 border-t border-line-soft px-3.5 py-2 font-mono text-[10.5px] leading-none text-muted">
            <span className={recalled > 0 ? 'text-accent' : ''}>
              {recalled > 0 ? `◈ ${recalled} memories recalled` : '◈ memory idle'}
            </span>
            <span className="ml-auto max-sm:hidden">local-first · your key</span>
          </div>
        </div>
      </div>

      {done && !reduced && (
        <button
          onClick={replay}
          aria-label="Replay demo"
          className="absolute inset-0 flex cursor-pointer items-end justify-end bg-transparent p-3.5"
        >
          <span className="rounded-full border border-line bg-[var(--bar-bg)] px-3 py-2 font-mono text-[11px] leading-none font-medium tracking-[0.08em] text-ink uppercase backdrop-blur-md">
            ↻ Replay
          </span>
        </button>
      )}
    </div>
  );
}
