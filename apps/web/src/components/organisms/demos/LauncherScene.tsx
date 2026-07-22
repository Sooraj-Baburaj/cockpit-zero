'use client';

import { useMemo, useState } from 'react';
import { fuzzyRank, toRanges } from '@cockpitzero/shared';
import { SearchIcon } from '@/components/atoms/SearchIcon';
import { DemoBackdrop, type BackdropVariant } from './Backdrop';
import { useDemoPlayer, typingSteps, type ScriptStep } from './player';
import type { DemoRow } from './rows';

/**
 * The generic live-demo engine. Every action-type demo is this scene with
 * different data and a different playout: hotkey press → the glass bar pops in
 * → the query types char-by-char → results rank live (via the *real*
 * `fuzzyRank` from @cockpitzero/shared — the same fzf ranking the launcher
 * ships) → selection moves → Enter → the action's payoff renders below.
 *
 * Scripted and self-contained: no IPC, network, or filesystem — just timers.
 */

const PHASES = ['idle', 'summon', 'bar', 'ready', 'enter', 'playout'] as const;
type Phase = (typeof PHASES)[number];

/** Scene density presets — compact fits carousel cards, large fills wide bands. */
export type SceneSize = 'compact' | 'default' | 'large';

const SIZE = {
  compact: { cap: 2, bar: 'w-[min(400px,94%)]', playout: 'w-[min(380px,94%)]', footer: false },
  default: { cap: 4, bar: 'w-[min(480px,94%)]', playout: 'w-[min(440px,94%)]', footer: true },
  large: { cap: 4, bar: 'w-[min(560px,94%)]', playout: 'w-[min(520px,94%)]', footer: true },
} as const;

const ASPECT: Record<SceneSize, string> = {
  compact: 'aspect-[4/5]',
  default: 'aspect-[4/5] sm:aspect-[16/10]',
  large: 'aspect-[4/5] sm:aspect-[16/10]',
};

export interface ScenePlayout {
  /** Number of beats after Enter; `render` receives the current beat (0-based). */
  steps: number;
  stepMs?: number;
  render: (step: number, done: boolean) => React.ReactNode;
}

export interface LauncherSceneProps {
  variant: BackdropVariant;
  /** Mono chip naming the demo, e.g. "OPEN URL". */
  label: string;
  query: string;
  rows: DemoRow[];
  /** The row the demo "user" runs — selection walks down to it if needed. */
  targetId: string;
  playout: ScenePlayout;
  size?: SceneSize;
  /** Skip the scene's own border + radius (when a parent supplies the frame). */
  frameless?: boolean;
  className?: string;
}

export function LauncherScene({
  variant,
  label,
  query,
  rows,
  targetId,
  playout,
  size = 'default',
  frameless = false,
  className = '',
}: LauncherSceneProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [selected, setSelected] = useState(0);
  const [playStep, setPlayStep] = useState(0);

  const at = (p: Phase) => PHASES.indexOf(phase) >= PHASES.indexOf(p);
  const sz = SIZE[size];

  // Live ranking of the scripted "config" — the launcher's actual brain.
  const results = useMemo(() => {
    if (typed.trim() === '') return [];
    return fuzzyRank(typed, rows, (r) => r.title)
      .slice(0, sz.cap)
      .map((r) => ({ row: r.item, ranges: toRanges(r.positions) }));
  }, [typed, rows, sz.cap]);

  // Where the target lands once the full query is typed (for selection steps).
  const targetIndex = useMemo(() => {
    const ranked = fuzzyRank(query, rows, (r) => r.title).slice(0, sz.cap);
    const i = ranked.findIndex((r) => r.item.id === targetId);
    return i < 0 ? 0 : i;
  }, [query, rows, targetId, sz.cap]);

  const { containerRef, reduced, done, replay } = useDemoPlayer(
    () => {
      const steps: ScriptStep[] = [
        { delay: 420, run: () => setPhase('summon') },
        { delay: 300, run: () => setPhase('bar') },
      ];
      const typing = typingSteps(query, setTyped);
      if (typing[0]) typing[0].delay += 430;
      steps.push(...typing);
      steps.push({ delay: 420, run: () => setPhase('ready') });
      for (let i = 1; i <= targetIndex; i++) {
        steps.push({ delay: 270, run: () => setSelected(i) });
      }
      steps.push({ delay: 500, run: () => setPhase('enter') });
      steps.push({ delay: 380, run: () => setPhase('playout') });
      for (let s = 1; s < playout.steps; s++) {
        steps.push({ delay: playout.stepMs ?? 700, run: () => setPlayStep(s) });
      }
      steps.push({ delay: 900, run: () => undefined }); // settle before "done"
      return steps;
    },
    () => {
      setPhase('idle');
      setTyped('');
      setSelected(0);
      setPlayStep(0);
    },
    () => {
      // Reduced motion: a finished, fully readable frame — no timers.
      setPhase('playout');
      setTyped(query);
      setSelected(targetIndex);
      setPlayStep(playout.steps - 1);
    },
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${frameless ? '' : 'rounded-[22px] border border-line'} ${className}`}
    >
      <DemoBackdrop variant={variant} />

      <div
        aria-hidden
        className={`relative flex flex-col items-center px-4 pt-[15%] sm:pt-[9%] ${ASPECT[size]}`}
      >
        <span className="absolute top-3.5 left-3.5 rounded-md border border-line-soft bg-[var(--bar-bg)] px-[7px] py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] uppercase text-muted backdrop-blur-md">
          {label}
        </span>

        {!at('bar') && (
          <div className="flex flex-1 -translate-y-[7%] items-center justify-center gap-[7px]">
            <HotkeyChip pressed={phase === 'summon'}>⌘</HotkeyChip>
            <HotkeyChip pressed={phase === 'summon'}>J</HotkeyChip>
          </div>
        )}

        {at('bar') && (
          <div
            className={`czd-pop ${sz.bar} overflow-hidden rounded-[18px] border border-[var(--bar-border)] bg-[var(--bar-bg)] backdrop-blur-[22px] backdrop-saturate-150 transition-[transform,opacity] duration-300 ${
              at('playout') ? 'scale-[0.98] opacity-60' : ''
            }`}
            style={{ boxShadow: 'var(--bar-shadow)' }}
          >
            <div className="flex items-center gap-2.5 border-b border-line-soft px-3.5 py-3">
              <SearchIcon size={16} />
              <div className="flex min-h-[20px] flex-1 items-center text-[15px] leading-tight font-medium text-ink">
                {!typed && <span className="text-muted">Search apps, files, actions…</span>}
                <span>{typed}</span>
                {!reduced && !at('playout') && (
                  <span className="cz-blink ml-0.5 inline-block h-4 w-0.5 bg-accent [animation:czblink_1s_step-end_infinite]" />
                )}
              </div>
              <span className="inline-flex gap-1">
                <Key>⌘</Key>
                <Key>J</Key>
              </span>
            </div>

            {results.length > 0 && (
              <div className="flex flex-col p-1.5">
                {results.map(({ row, ranges }, i) => (
                  <ResultRow
                    key={row.id}
                    row={row}
                    ranges={ranges}
                    selected={i === selected}
                    firing={i === selected && at('enter')}
                  />
                ))}
              </div>
            )}

            {sz.footer && (
              <div className="flex items-center gap-3.5 border-t border-line-soft px-3.5 py-2 font-mono text-[10.5px] leading-none text-muted">
                <span>↑↓ navigate</span>
                <span className={at('ready') && !at('playout') ? 'text-accent' : ''}>↵ run</span>
                <span className="ml-auto max-sm:hidden">esc · gone</span>
              </div>
            )}
          </div>
        )}

        {at('playout') && (
          <div className={`czd-rise mt-3.5 ${sz.playout}`}>{playout.render(playStep, done)}</div>
        )}
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

function HotkeyChip({ pressed, children }: { pressed: boolean; children: React.ReactNode }) {
  return (
    <kbd
      className={`rounded-lg border px-3.5 py-2.5 font-mono text-[15px] font-medium transition-all duration-150 ${
        pressed
          ? 'scale-95 border-accent bg-accent-soft text-ink'
          : 'border-line bg-[var(--bar-bg)] text-muted backdrop-blur-md'
      }`}
    >
      {children}
    </kbd>
  );
}

/** Small in-bar kbd — the hero `Kbd` at the scene's reduced scale. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-line-soft bg-surface-3 px-1.5 py-[3px] font-mono text-[10.5px] leading-none font-medium text-muted">
      {children}
    </kbd>
  );
}

function ResultRow({
  row,
  ranges,
  selected,
  firing,
}: {
  row: DemoRow;
  ranges: Array<[number, number]>;
  selected: boolean;
  firing: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors duration-150 ${
        selected ? 'bg-accent-soft' : ''
      } ${firing ? 'outline-1 outline-accent/50' : ''}`}
    >
      <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-surface-3 font-mono text-[13px] leading-none font-medium text-ink">
        {row.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] leading-tight font-medium text-ink">
          <Highlighted text={row.title} ranges={ranges} />
        </span>
        <span className="block truncate font-mono text-[11px] leading-[1.35] text-muted">
          {row.subtitle}
        </span>
      </span>
      <span className="flex-none rounded-md border border-line-soft px-1.5 py-[3px] font-mono text-[9px] leading-none font-medium tracking-[0.08em] uppercase text-muted">
        {row.badge}
      </span>
    </div>
  );
}

/** Renders fzf's matched-character ranges in the accent — like the launcher. */
function Highlighted({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  if (ranges.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <span key={start} className="text-accent">
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}
