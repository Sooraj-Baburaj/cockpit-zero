import { useEffect, useRef, useState } from 'react';
import type { Config, Digest, DigestItem } from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useAppearance } from '../hooks/useAppearance.js';
import { useKeyboardNav } from '../hooks/useKeyboardNav.js';
import { DigestPanel } from '../components/organisms/DigestPanel.js';
import { EmptyState } from '../components/atoms/EmptyState.js';
import { Button } from '../components/atoms/Button.js';
import { Toast } from '../components/molecules/Toast.js';

interface Feedback {
  message: string;
  error: boolean;
}

const LISTBOX_ID = 'cz-digest';
const optionId = (index: number) => `cz-digest-opt-${index}`;

/** The routine which digest this window shows — passed via the URL hash by the
 *  window opener (`digest.html#<routineId>`). */
function routineIdFromHash(): string {
  if (typeof window === 'undefined') return '';
  return decodeURIComponent(window.location.hash.replace(/^#/, ''));
}

/**
 * The dedicated briefing window (Phase 5). Fetches the routine's last-computed
 * digest, renders it via `DigestPanel`, and makes every item keyboard-operable:
 * `↵` opens it, `e` archives, `r` replies with AI. Archive/reply are local stubs
 * here — the real side-effects arrive with Phase 7's tool layer.
 */
export function DigestScreen() {
  const [routineId] = useState(routineIdFromHash);
  const [config, setConfig] = useState<Config | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.getConfig().then(setConfig);
    void api.getDigest(routineId).then((d) => {
      setDigest(d);
      setLoaded(true);
    });
    rootRef.current?.focus();
  }, [routineId]);

  useAppearance(config?.settings);

  // Flatten the two groups into one navigable list (group headers are skipped).
  const items: DigestItem[] = digest ? [...digest.groups.now, ...digest.groups.wait] : [];

  const flash = (message: string, error = false) => {
    setFeedback({ message, error });
    window.setTimeout(() => setFeedback(null), 2500);
  };

  /** `↵` — open the item's deep link / app path, when it has one. */
  const openItem = (index: number) => {
    const item = items[index];
    if (!item) return;
    if (!item.openPath) {
      flash('Nothing to open for this item.');
      return;
    }
    void api.openPath(item.openPath).then((res) => {
      if (!res.ok) flash(res.error ?? 'Could not open', true);
    });
  };

  const { selected, setSelected, handleKeyDown } = useKeyboardNav({
    count: items.length,
    resetKey: routineId,
    onSelect: openItem,
    onClose: () => window.close(),
  });

  /** `e` / `r` — archive / reply. Local stubs until Phase 7 wires the tool layer. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'e' || e.key === 'r') && items[selected]) {
      e.preventDefault();
      flash(
        e.key === 'e'
          ? 'Archived locally — sync arrives with the tool layer.'
          : 'Reply with AI is coming with the tool layer.',
      );
      return;
    }
    handleKeyDown(e);
  };

  const runNow = () => {
    void api.runRoutine(routineId).then(setDigest);
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="cz-window relative flex h-screen flex-col text-fg outline-none"
    >
      {digest ? (
        <DigestPanel
          digest={digest}
          selected={selected}
          listboxId={LISTBOX_ID}
          optionId={optionId}
          onSelect={openItem}
          onHover={setSelected}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <EmptyState
            title={loaded ? 'No briefing yet' : 'Loading briefing…'}
            hint={loaded ? 'Run this routine to pull and summarize your notifications.' : ''}
          />
          {loaded && (
            <Button variant="primary" onClick={runNow}>
              Run now
            </Button>
          )}
        </div>
      )}

      <footer className="flex items-center justify-between border-t [border-color:var(--cz-line-faint)] px-6 py-3.5">
        <div className="flex items-center gap-4">
          <Hint cap="↵" label="open" />
          <Hint cap="e" label="archive" />
          <Hint cap="r" label="reply with AI" />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-subtle">
          COCKPIT ZERO <span className="size-[7px] rounded-full [background:var(--cz-accent)]" />
        </div>
      </footer>

      {feedback && <Toast message={feedback.message} error={feedback.error} />}
    </div>
  );
}

/** A footer key hint (`.cap` + label) from the mockup. */
function Hint({ cap, label }: { cap: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--cz-radius-xs)] border [border-color:var(--cz-line-strong)] px-1.5 font-mono text-[11px] text-muted [background:var(--cz-surface-inset)]">
        {cap}
      </span>
      {label}
    </span>
  );
}
