import type { LauncherItem, LauncherItemKind } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { useResultIcon } from '../../hooks/useResultIcon.js';

/** A small outline glyph per result kind, so apps/files read at a glance. */
const glyphs: Record<LauncherItemKind, React.ReactNode> = {
  action: <path d="M8.5 1.5 3.5 9H7l-.5 5.5L12.5 7H9l-.5-5.5Z" />,
  workflow: (
    <>
      <path d="M8 2 14 5l-6 3-6-3 6-3Z" />
      <path d="m2 8 6 3 6-3" />
      <path d="m2 11 6 3 6-3" />
    </>
  ),
  app: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  file: (
    <>
      <path d="M4 2h5l3 3v9H4Z" />
      <path d="M9 2v3h3" />
    </>
  ),
};

/**
 * Themed icon chip at the start of a launcher result row. Apps and files show
 * their real OS icon once it loads — full-colour, never tinted or lit, so the
 * native icon carries the colour. Configured actions/workflows (and any icon
 * that fails to load) fall back to the thin-line kind glyph on an inset chip;
 * `lit` (the selected row): flat accent fill — the row's one accent moment.
 */
export function ResultIcon({ item, lit = false }: { item: LauncherItem; lit?: boolean }) {
  const kind: LauncherItemKind = item.kind;
  const nativeIcon = useResultIcon(item);

  if (nativeIcon) {
    return (
      <span className="flex size-[30px] shrink-0 items-center justify-center">
        <img src={nativeIcon} alt="" className="size-6 rounded-[5px] object-contain" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex size-[30px] shrink-0 items-center justify-center rounded-[var(--cz-radius-chip)] border transition-[background,box-shadow,color] duration-180',
        lit
          ? 'border-transparent text-accent-fg [background:var(--cz-accent)] [box-shadow:var(--cz-glow-chip)]'
          : 'border-border bg-[var(--cz-surface-inset)] text-muted',
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {glyphs[kind]}
      </svg>
    </span>
  );
}
