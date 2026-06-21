import { cn } from '../../lib/cn.js';

type Tone = 'neutral' | 'accent' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'text-muted bg-surface-2 border-border',
  accent:
    'text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]',
  danger: 'text-[var(--cz-danger)] [background:var(--cz-danger-soft)] border-transparent',
};

/** Small uppercase pill for metadata (e.g. an action type). `accent` tone lights
 *  up in the active/selected context. */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] border px-1.5 py-[3px] text-[10px] leading-none font-semibold tracking-[0.08em] whitespace-nowrap uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
