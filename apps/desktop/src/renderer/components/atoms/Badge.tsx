import { cn } from '../../lib/cn.js';

/**
 * `neutral` / `accent` / `danger` are the generic tones. The rest are the
 * design system's per-kind badge palette — each result/action kind carries its
 * own hue so a scanned list reads by colour as well as by word.
 */
type Tone =
  | 'neutral'
  | 'accent'
  | 'danger'
  | 'url'
  | 'app'
  | 'workflow'
  | 'script'
  | 'command'
  | 'file';

const tones: Record<Tone, string> = {
  neutral: 'text-muted bg-surface-2 border-border',
  accent:
    'text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]',
  danger: 'text-[var(--cz-danger)] [background:var(--cz-danger-soft)] border-transparent',
  url: 'text-[var(--cz-badge-url-fg)] [background:var(--cz-badge-url-bg)] [border-color:var(--cz-badge-url-line)]',
  app: 'text-[var(--cz-badge-app-fg)] [background:var(--cz-badge-app-bg)] [border-color:var(--cz-badge-app-line)]',
  workflow:
    'text-[var(--cz-badge-workflow-fg)] [background:var(--cz-badge-workflow-bg)] [border-color:var(--cz-badge-workflow-line)]',
  script:
    'text-[var(--cz-badge-script-fg)] [background:var(--cz-badge-script-bg)] [border-color:var(--cz-badge-script-line)]',
  command:
    'text-[var(--cz-badge-command-fg)] [background:var(--cz-badge-command-bg)] [border-color:var(--cz-badge-command-line)]',
  file: 'text-[var(--cz-badge-file-fg)] [background:var(--cz-badge-file-bg)] [border-color:var(--cz-badge-file-line)]',
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
        'inline-flex items-center rounded-[var(--cz-radius-xs)] border px-[7px] py-[3px] font-mono text-[9.5px] leading-none font-medium tracking-[var(--cz-tracking-label)] whitespace-nowrap uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type BadgeTone = Tone;
