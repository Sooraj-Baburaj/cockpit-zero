import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type {
  AccountStatus,
  AiSettings,
  KnowledgeDoc,
  MemoryRecord,
  MemoryStats,
} from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { Button } from '../atoms/Button.js';
import { Input } from '../atoms/Input.js';
import { Toggle } from '../atoms/Toggle.js';

/**
 * Console → Memory (local memory engine, production phase 5 + cloud sync, phase
 * 8). The view over everything the assistant has remembered: a stats header
 * (count, last-updated, embedding source), a search box (hybrid recall over the
 * engine), the matching entries with per-entry **forget**, and a global **clear
 * all**.
 *
 * By default everything is on-device — memory never leaves the machine. A
 * **signed-in** user additionally gets the opt-in cloud section (P8): a "Sync
 * memory across devices" toggle + "Sync now", and a **Knowledge** view to ingest
 * documents (PDF/text) into the cloud knowledge base the assistant cites. When
 * `ai.memoryEnabled` is off the assistant stops reading/writing memory, but this
 * management surface stays usable so the user can still inspect and clear what's
 * stored. Reuses the Facet atoms; keyboard-first.
 */
export function MemoryPanel({
  ai,
  onSaveAi,
}: {
  ai: AiSettings;
  onSaveAi: (ai: AiSettings) => void;
}) {
  const memoryEnabled = ai.memoryEnabled;
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
        <h1 className="text-[19px] leading-none font-semibold text-fg">
          Memory
        </h1>
        <StatsChip stats={stats} />
      </header>

      <p className="mb-4 max-w-[64ch] text-[13px] leading-relaxed text-muted">
        Durable facts the assistant has learned from your sessions — recalled to make answers
        context-aware.{' '}
        {ai.memorySync
          ? 'Cloud sync is on — memories also sync to your account (opt-in, below).'
          : 'Everything here stays on this device.'}
      </p>

      {!memoryEnabled && (
        <div className="mb-4 rounded-[var(--cz-radius-md)] border [border-color:var(--cz-warn)] [background:var(--cz-surface)] px-[18px] py-[13px] text-[13px] text-muted">
          Memory is <b className="font-semibold text-fg">off</b> — the assistant isn’t reading or
          writing new memories. Turn it on in <b className="text-fg">Console → AI</b>. You can still
          review and clear what’s stored below.
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

      <CloudSection
        memorySync={ai.memorySync}
        onToggleSync={(on) => onSaveAi({ ...ai, memorySync: on })}
      />

      <footer className="mt-7 flex items-center justify-between gap-4 border-t [border-color:var(--cz-line-faint)] pt-4">
        <span className="text-[12.5px] text-subtle">
          Local-first · {stats?.embeddingSource === 'provider' ? 'provider' : 'on-device'}{' '}
          embeddings · {ai.memorySync ? 'cloud sync on (opt-in).' : 'never synced.'}
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

/**
 * The P8 cloud section: opt-in cross-device memory sync + the Knowledge view.
 * Renders a quiet sign-in hint when logged out — everything above stays fully
 * local and functional without an account.
 */
function CloudSection({
  memorySync,
  onToggleSync,
}: {
  memorySync: boolean;
  onToggleSync: (on: boolean) => void;
}) {
  // null = account status not yet loaded (render nothing rather than flash).
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const signedIn = account?.signedIn === true;

  useEffect(() => {
    void api.authStatus().then(setAccount);
  }, []);

  const refreshDocs = useCallback(() => {
    void api.knowledgeList().then((res) => {
      if (res.ok) setDocs(res.docs);
    });
  }, []);

  useEffect(() => {
    if (signedIn) refreshDocs();
  }, [signedIn, refreshDocs]);

  if (account === null) return null;

  if (!signedIn) {
    return (
      <section className="mt-7 rounded-[var(--cz-radius-md)] border border-dashed [border-color:var(--cz-line-strong)] [background:var(--cz-surface)] px-[18px] py-[14px] text-[13px] text-muted">
        <b className="font-semibold text-fg">Cloud memory is optional.</b> Sign in (Console →
        Account) to sync memory across devices and add documents the assistant can cite. Until then,
        everything stays on this device.
      </section>
    );
  }

  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok && result.error) setError(result.error);
    } finally {
      setBusy(null);
    }
  };

  const syncNow = () =>
    run('sync', async () => {
      const result = await api.memorySyncNow();
      if (result.ok) {
        setLastSyncedAt(result.syncedAt ?? Date.now());
        setNotice(
          `Synced — pushed ${result.pushed}, pulled ${result.pulled} ${
            result.pulled === 1 ? 'memory' : 'memories'
          }.`,
        );
      }
      return result;
    });

  const addDocuments = () =>
    run('ingest', async () => {
      const result = await api.knowledgeIngest([]);
      if (result.docIds.length > 0) {
        refreshDocs();
        setNotice(
          `Added ${result.docIds.length} ${result.docIds.length === 1 ? 'document' : 'documents'} to your knowledge.`,
        );
      }
      return result;
    });

  const removeDoc = (docId: string) =>
    run(`remove:${docId}`, async () => {
      const result = await api.knowledgeRemove(docId);
      if (result.ok) setDocs((prev) => prev.filter((d) => d.docId !== docId));
      return result;
    });

  return (
    <section className="mt-7 space-y-3">
      <div className="rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-surface)] px-[18px] py-[15px] [box-shadow:var(--cz-shadow-sm)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[14.5px] font-semibold text-fg">Sync memory across devices</div>
            <p className="mt-[3px] max-w-[52ch] text-[13px] leading-relaxed text-muted">
              <b className="font-medium text-fg">Opt-in.</b> Memories sync to your account so recall
              works on every device you sign into. Turn it off any time — new memories then stay
              local.
            </p>
          </div>
          <Toggle
            checked={memorySync}
            onChange={onToggleSync}
            ariaLabel="Sync memory across devices"
          />
        </div>
        {memorySync && (
          <div className="mt-3 flex items-center gap-3">
            <Button variant="primary" onClick={() => void syncNow()} disabled={busy !== null}>
              {busy === 'sync' ? 'Syncing…' : 'Sync now'}
            </Button>
            {lastSyncedAt !== null && (
              <span className="text-[12.5px] text-subtle">
                Last synced {formatWhen(lastSyncedAt)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-surface)] px-[18px] py-[15px] [box-shadow:var(--cz-shadow-sm)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[14.5px] font-semibold text-fg">Knowledge</div>
            <p className="mt-[3px] max-w-[52ch] text-[13px] leading-relaxed text-muted">
              Documents (PDF, text) ingested into your cloud knowledge base — the assistant recalls
              and cites them in answers. Removing one deletes it for real.
            </p>
          </div>
          <Button variant="outline" onClick={() => void addDocuments()} disabled={busy !== null}>
            {busy === 'ingest' ? 'Adding…' : 'Add documents…'}
          </Button>
        </div>

        {docs.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {docs.map((doc) => (
              <li
                key={doc.docId}
                className="group flex items-center gap-3 rounded-[var(--cz-radius-sm)] border border-border [background:var(--cz-surface-inset)] px-[12px] py-[8px]"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-fg">{doc.name}</span>
                  <span className="text-[12px] text-subtle">
                    {doc.chunks} {doc.chunks === 1 ? 'chunk' : 'chunks'} ·{' '}
                    {doc.status === 'ready' ? formatWhen(doc.createdAt) : doc.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void removeDoc(doc.docId)}
                  aria-label={`Remove document: ${doc.name}`}
                  className="shrink-0 rounded-md px-2 py-1 text-[12.5px] font-medium text-subtle opacity-0 transition group-hover:opacity-100 hover:text-[var(--cz-danger)] hover:[background:var(--cz-danger-soft)] focus-visible:opacity-100"
                >
                  {busy === `remove:${doc.docId}` ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-[12.5px] [color:var(--cz-danger)]">{error}</p>}
      {notice && <p className="text-[12.5px] [color:var(--cz-success)]">{notice}</p>}
    </section>
  );
}

/** One memory row: kind badge + text, with the timestamp and a forget control. */
function MemoryRow({ entry, onForget }: { entry: MemoryRecord; onForget: () => void }) {
  return (
    <li className="group flex items-start gap-3 rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-surface)] px-[16px] py-[12px] [box-shadow:var(--cz-shadow-sm)]">
      <span className="mt-[2px] shrink-0 rounded-[var(--cz-radius-pill)] border border-border [background:var(--cz-surface-inset)] px-[9px] py-[2px] text-[11px] font-medium tracking-[0.02em] text-muted capitalize">
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
    <span className="inline-flex items-center gap-2 rounded-[var(--cz-radius-pill)] border border-border [background:var(--cz-surface)] px-[13px] py-1.5 text-xs font-medium text-muted [box-shadow:var(--cz-shadow-sm)]">
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
    <div className="rounded-[var(--cz-radius-md)] border border-dashed [border-color:var(--cz-line-strong)] [background:var(--cz-surface)] px-[18px] py-10 text-center text-[13px] text-muted">
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
