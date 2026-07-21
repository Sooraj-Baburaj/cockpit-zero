import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiStreamEvent, ChatMessage, ChatSession, ChatSummary, Config } from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { cn } from '../lib/cn.js';
import { useAppearance } from '../hooks/useAppearance.js';
import { Button } from '../components/atoms/Button.js';
import { EmptyState } from '../components/atoms/EmptyState.js';
import { Sparkle } from '../components/atoms/Sparkle.js';

/** markdown-lite bold (same rule as AiAnswerPanel): `**x**` → <b>. */
function renderBold(text: string): React.ReactNode[] {
  return text.split('**').map((seg, i) =>
    i % 2 === 1 ? (
      <b key={i} className="font-semibold">
        {seg}
      </b>
    ) : (
      seg
    ),
  );
}

/** Compact relative timestamp for the session sidebar ("now", "5m", "2d"). */
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

/** A live reply stream: its (eventually-known) id + the listener teardown —
 *  the same subscription shape as `useAiAsk` (events can precede the resolved id). */
interface StreamSub {
  id: string | null;
  unsubscribe: () => void;
}

/**
 * The dedicated AI window: persisted chat sessions in a sidebar, a streaming
 * conversation on the right. Transcripts live in the main process
 * (`userData/chats.json`) — this screen only renders snapshots (`chatGet`) and
 * the in-flight stream, so closing it mid-reply loses nothing.
 */
export function AiChatScreen() {
  const [config, setConfig] = useState<Config | null>(null);
  const [sessions, setSessions] = useState<ChatSummary[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [draft, setDraft] = useState('');
  /** The reply being streamed for the active session, or null when idle. */
  const [streamText, setStreamText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subRef = useRef<StreamSub | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useAppearance(config?.settings);

  const refreshList = useCallback(async () => {
    const list = await api.chatList();
    setSessions(list);
    return list;
  }, []);

  const open = useCallback(async (sessionId: string) => {
    const s = await api.chatGet(sessionId);
    setSession(s);
    setError(null);
    inputRef.current?.focus();
  }, []);

  // Boot: config + sessions; open the newest session or start a fresh one.
  useEffect(() => {
    void api.getConfig().then(setConfig);
    void refreshList().then(async (list) => {
      const first = list[0] ?? (await api.chatCreate());
      if (list.length === 0) await refreshList();
      await open(first.id);
    });
    return () => subRef.current?.unsubscribe();
  }, [refreshList, open]);

  // Keep the newest message in view while the transcript grows or streams.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [session?.messages.length, streamText]);

  const busy = streamText !== null;

  const newChat = async () => {
    if (busy) return;
    const s = await api.chatCreate();
    await refreshList();
    await open(s.id);
  };

  const removeChat = async (sessionId: string) => {
    await api.chatDelete(sessionId);
    const list = await refreshList();
    if (session?.id === sessionId) {
      const next = list[0] ?? (await api.chatCreate());
      if (list.length === 0) await refreshList();
      await open(next.id);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (text === '' || !session || busy) return;
    setDraft('');
    setError(null);

    // Optimistic user turn — the main process persists the canonical copy.
    const optimistic: ChatMessage = { id: `local_${Date.now()}`, role: 'user', text, at: Date.now() };
    const sessionId = session.id;
    setSession({ ...session, messages: [...session.messages, optimistic] });
    setStreamText('');

    const finish = () => {
      subRef.current?.unsubscribe();
      subRef.current = null;
      setStreamText(null);
      void refreshList();
      void open(sessionId);
    };

    // Subscribe before invoking so no early delta is missed (same pattern as
    // useAiAsk); events are matched by streamId once it resolves.
    const sub: StreamSub = { id: null, unsubscribe: () => {} };
    sub.unsubscribe = api.onAiStream((e: AiStreamEvent) => {
      if (sub.id === null || e.streamId !== sub.id) return;
      if (e.type === 'delta') setStreamText((t) => (t ?? '') + e.text);
      else if (e.type === 'done') finish();
      else {
        setError(e.message);
        finish();
      }
    });
    subRef.current = sub;

    void api.chatAsk(sessionId, text).then(({ streamId, error: err }) => {
      if (err || !streamId) {
        setError(err ?? 'Could not send.');
        finish();
        return;
      }
      if (subRef.current !== sub) {
        void api.cancelAiStream(streamId);
        return;
      }
      sub.id = streamId;
    });
  };

  const onComposerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="cz-window flex h-screen text-fg">
      {/* Session sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r [border-color:var(--cz-line-faint)] [background:var(--cz-surface-inset)]">
        <div className="flex items-center justify-between px-4 pt-4 pb-2.5">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
            Chats
          </span>
          <Button variant="primary" size="sm" onClick={() => void newChat()} disabled={busy}>
            New chat
          </Button>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" aria-label="Chat history">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                'group flex items-center gap-2 rounded-[var(--cz-radius-sm)] px-2.5 py-2 transition',
                s.id === session?.id
                  ? '[background:var(--cz-surface)] [box-shadow:var(--cz-shadow-sm)]'
                  : 'hover:[background:var(--cz-surface)]',
              )}
            >
              <button
                type="button"
                onClick={() => void open(s.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[13px] font-medium text-fg">{s.title}</span>
                <span className="mt-px block font-mono text-[11px] text-subtle">
                  {timeAgo(s.updatedAt)} ·{' '}
                  {s.messageCount === 0
                    ? 'empty'
                    : `${s.messageCount} message${s.messageCount === 1 ? '' : 's'}`}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete “${s.title}”`}
                onClick={() => void removeChat(s.id)}
                className="rounded p-1 text-subtle opacity-0 transition group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* Conversation pane */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2.5 border-b [border-color:var(--cz-line-faint)] px-6 py-3.5">
          <Sparkle className="size-[18px] shrink-0 text-accent" />
          <h1 className="min-w-0 truncate text-[15px] font-semibold">
            {session?.title ?? 'New chat'}
          </h1>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {session && session.messages.length === 0 && streamText === null ? (
              <div className="pt-16">
                <EmptyState
                  title="Ask CockpitZero anything"
                  hint="Answers use your configured provider and memory. Describe a task in the launcher to have the agent do it."
                />
              </div>
            ) : (
              session?.messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            {streamText !== null && (
              <MessageBubble
                message={{ id: 'streaming', role: 'assistant', text: streamText, at: Date.now() }}
                streaming
              />
            )}
            {error && (
              <p role="alert" className="px-1 text-[12.5px] [color:var(--cz-warn)]">
                {error}
              </p>
            )}
          </div>
        </div>

        <footer className="border-t [border-color:var(--cz-line-faint)] px-6 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="mx-auto flex max-w-2xl items-end gap-3 rounded-[var(--cz-radius-lg)] border [border-color:var(--cz-accent-line)] [background:var(--cz-surface)] px-4 py-3 [box-shadow:var(--cz-shadow-md),var(--cz-glow-chip)]"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKeyDown}
              rows={Math.min(4, Math.max(1, draft.split('\n').length))}
              placeholder="Message CockpitZero… (Enter to send, Shift+Enter for a new line)"
              aria-label="Message CockpitZero"
              className="max-h-40 min-w-0 flex-1 resize-none bg-transparent text-[14.5px] leading-relaxed text-fg outline-none placeholder:text-subtle"
            />
            <Button type="submit" variant="primary" disabled={draft.trim() === '' || busy}>
              Send
            </Button>
          </form>
        </footer>
      </main>
    </div>
  );
}

/** One transcript row: user turns as inset chips on the right, assistant turns
 *  as plain prose with the spark mark on the left. */
function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-surface-inset)] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <Sparkle
        className={cn('mt-1 size-4 shrink-0 text-accent', streaming && 'animate-pulse')}
      />
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed whitespace-pre-wrap">
        {message.text === '' && streaming ? (
          <span className="text-subtle">Thinking…</span>
        ) : (
          renderBold(message.text)
        )}
      </div>
    </div>
  );
}
