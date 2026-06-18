import type { LauncherItemKind } from '@cockpitzero/shared';

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

/** Themed icon chip shown at the start of a launcher result row. */
export function ResultIcon({ kind }: { kind: LauncherItemKind }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
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
