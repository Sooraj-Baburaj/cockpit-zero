import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { MemoryRecord, MemoryStats } from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { Button } from '../atoms/Button.js';
import { Input } from '../atoms/Input.js';

/**
 * Console → Memory (local memory engine, production phase 5). The local + private
 * view over everything the assistant has remembered: a stats header (count,
 * last-updated, embedding source), a search box (hybrid recall over the engine),
 * the matching entries with per-entry **forget**, and a global **clear all**.
 *
 * Everything here is on-device — memory never leaves the machine (until logged-in
 * sync in a later phase). When `ai.memoryEnabled` is off the assistant stops
 * reading/writing memory, but this management surface stays usable so the user can
 * still inspect and clear what's stored. Reuses Sahara atoms; keyboard-first.
 */
export function MemoryPanel({ memoryEnabled }: { memoryEnabled: boolean }) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<MemoryRecord[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const refreshStats = useCallback(() => void api.memoryStats().then(setStats), []);

  // Search on every query change (lightly debounced so typing doesn't thrash the
  // engine); the empty query lists the most-recent entries.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void api.memorySearch(query).then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        setLoading(false);
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(refreshStats, [refreshStats]);

  const forget = async (id: string) => {
    await api.memoryForget(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    refreshStats();
  };

  const clearAll = async () => {
    await api.memoryClear();
    setEntries([]);
    setConfirmingClear(false);
    refreshStats();
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-serif text-[30px] leading-none font-medium tracking-[-0.015em] text-fg">
          Memory
        </h1>
        <StatsChip stats={stats} />
      </header>

      <p className="mb-4 max-w-[64ch] text-[13px] leading-relaxed text-muted">
        Durable facts the assistant has learned from your sessions — recalled to make
        answers context-aware. Everything here stays on this device.
      </p>

      {!memoryEnabled && (
        <div className="mb-4 rounded-[var(--cz-radius-md)] border [border-color:var(--cz-warn)] [background:var(--cz-glass-1)] px-[18px] py-[13px] text-[13px] text-muted">
          Memory is <b className="font-semibold text-fg">off</b> — the assistant isn’t
          reading or writing new memories. Turn it on in <b className="text-fg">Console → AI</b>.
          You can still review and clear what’s stored below.
        </div>
      )}

      <div className="relative mb-4">
        <SearchGlyph />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memories…"
          aria-label="Search memories"
          autoComplete="off"
          spellCheck={false}
          className="pl-9"
        />
      </div>

      {loading && entries.length === 0 ? (
        <EmptyState>Loading…</EmptyState>
      ) : entries.length === 0 ? (
        <EmptyState>
          {query.trim() === ''
            ? 'No memories yet. Ask the assistant something — it’ll remember what matters.'
            : `No memories match “${query.trim()}”.`}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <MemoryRow key={entry.id} entry={entry} onForget={() => void forget(entry.id)} />
          ))}
        </ul>
      )}

      <footer className="mt-7 flex items-center justify-between gap-4 border-t [border-color:var(--cz-line-faint)] pt-4">
        <span className="text-[12.5px] text-subtle">
          Local-first · {stats?.embeddingSource === 'provider' ? 'provider' : 'on-device'} embeddings
          · never synced.
        </span>
        {confirmingClear ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setConfirmingClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void clearAll()}>
              Confirm — clear all
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            disabled={(stats?.count ?? 0) === 0}
            onClick={() => setConfirmingClear(true)}
          >
            Clear all memory
          </Button>
        )}
      </footer>
    </div>
  );
}

/** One memory row: kind badge + text, with the timestamp and a forget control. */
function MemoryRow({ entry, onForget }: { entry: MemoryRecord; onForget: () => void }) {
  return (
    <li className="group flex items-start gap-3 rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-1)] px-[16px] py-[12px] [box-shadow:var(--cz-shadow-sm)]">
      <span className="mt-[2px] shrink-0 rounded-[var(--cz-radius-full)] border border-border [background:var(--cz-glass-2)] px-[9px] py-[2px] text-[11px] font-medium tracking-[0.02em] text-muted capitalize">
        {entry.kind}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug text-fg">{entry.text}</p>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-subtle">
          <span>{formatWhen(entry.updatedAt)}</span>
          {entry.source && (
            <>
              <span aria-hidden>·</span>
              <span>{entry.source}</span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onForget}
        aria-label={`Forget: ${entry.text}`}
        className="shrink-0 rounded-md px-2 py-1 text-[12.5px] font-medium text-subtle opacity-0 transition group-hover:opacity-100 hover:text-[var(--cz-danger)] hover:[background:var(--cz-danger-soft)] focus-visible:opacity-100"
      >
        Forget
      </button>
    </li>
  );
}

/** The "N memories · updated X" pill in the header (mirrors the AI ConnectionChip). */
function StatsChip({ stats }: { stats: MemoryStats | null }) {
  const label = !stats
    ? 'Checking…'
    : stats.count === 0
      ? 'Empty'
      : `${stats.count} ${stats.count === 1 ? 'memory' : 'memories'}`;
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--cz-radius-full)] border border-border [background:var(--cz-glass-1)] px-[13px] py-1.5 text-xs font-medium text-muted [box-shadow:var(--cz-shadow-sm)]">
      <span className="size-[7px] rounded-full [background:var(--cz-accent)]" />
      {label}
      {stats && stats.updatedAt !== null && (
        <>
          <span aria-hidden>·</span>
          <span className="text-subtle">updated {formatWhen(stats.updatedAt)}</span>
        </>
      )}
    </span>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--cz-radius-md)] border border-dashed [border-color:var(--cz-line-strong)] [background:var(--cz-glass-1)] px-[18px] py-10 text-center text-[13px] text-muted">
      {children}
    </div>
  );
}

/** Compact relative time ("just now" / "3h ago" / "2d ago" / a date past a week). */
function formatWhen(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Inset search icon for the memory search field. */
function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
