import { cn } from '../../lib/cn.js';

/**
 * Facet badges are deliberately MONOCHROME: the kind is carried by the label
 * and the row glyph, so badges never add colour that would fight full-colour
 * OS app icons. `accent` is the one lit exception (AI/draft moments) and
 * `danger` the rare destructive marker.
 */
type Tone = 'neutral' | 'accent' | 'danger';

const tones: Record<Tone, string> = {
  neutral:
    'text-[var(--cz-badge-fg)] [background:var(--cz-badge-bg)] [border-color:var(--cz-badge-line)]',
  accent:
    'text-[var(--cz-accent-text)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]',
  danger: 'text-[var(--cz-danger)] [background:var(--cz-danger-soft)] border-transparent',
};

/** Small uppercase mono pill for metadata (e.g. an action type). */
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
        'inline-flex items-center rounded-[var(--cz-radius-sm)] border px-[7px] py-[3px] font-mono text-[10px] leading-none font-semibold tracking-[0.08em] whitespace-nowrap uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type BadgeTone = Tone;
