import { chatPrompt, chatSummary, chatTitleFrom, createId } from '@cockpitzero/shared';
import type { AiAnswer, ChatMessage, ChatSession, ChatSummary } from '@cockpitzero/shared';
import type { ChatStorePort } from '../../infra/chat-store.js';

/**
 * The AI chat window's use-case layer: session CRUD + the multi-turn ask. Pure
 * and dependency-injected (a store port + the existing streamed ask), so it
 * unit-tests in plain Node with a fake store and a scripted ask — no
 * `electron`, no provider. Multi-turn context rides the single-prompt
 * `askStream` path via `chatPrompt` (shared), so every provider gets history
 * without a per-provider messages API.
 *
 * Persistence rules: the user turn is written before the provider is called
 * and the assistant turn is written when the stream completes — both in the
 * main process, so a closed window mid-stream never loses the exchange.
 */

export interface ChatServiceDeps {
  store: ChatStorePort;
  /** The streamed ask (the AI service's) — memory recall + provider selection
   *  already live behind it. */
  ask: (
    prompt: string,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ) => Promise<AiAnswer>;
  now?: () => number;
  newId?: (prefix: string) => string;
}

export interface ChatService {
  list(): ChatSummary[];
  get(sessionId: string): ChatSession | null;
  /** Start a session — or reuse the newest empty one, so "New chat" spam
   *  doesn't litter the sidebar. */
  create(): ChatSession;
  remove(sessionId: string): { ok: boolean };
  /** One chat turn: persist the user message, stream the reply, persist it.
   *  Resolves with the finalized assistant message. Throws for an unknown
   *  session / blank text (the IPC layer maps that to `{ error }`). */
  ask(
    sessionId: string,
    text: string,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatMessage>;
}

export function createChatService({
  store,
  ask,
  now = () => Date.now(),
  newId = createId,
}: ChatServiceDeps): ChatService {
  const bySession = (sessions: ChatSession[], id: string) => sessions.find((s) => s.id === id);

  return {
    list() {
      return store
        .load()
        .sessions.map(chatSummary)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    get(sessionId) {
      return bySession(store.load().sessions, sessionId) ?? null;
    },

    create() {
      const data = store.load();
      const empty = data.sessions
        .filter((s) => s.messages.length === 0)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (empty) return empty;

      const session: ChatSession = {
        id: newId('chat'),
        title: 'New chat',
        createdAt: now(),
        updatedAt: now(),
        messages: [],
      };
      store.save({ ...data, sessions: [...data.sessions, session] });
      return session;
    },

    remove(sessionId) {
      const data = store.load();
      const sessions = data.sessions.filter((s) => s.id !== sessionId);
      if (sessions.length !== data.sessions.length) store.save({ ...data, sessions });
      return { ok: true };
    },

    async ask(sessionId, text, onDelta, signal) {
      const q = text.trim();
      if (q === '') throw new Error('Nothing to send.');

      // Persist the user turn (and the derived title) before the provider call.
      const data = store.load();
      const session = bySession(data.sessions, sessionId);
      if (!session) throw new Error('This chat no longer exists.');
      const history = [...session.messages];
      session.messages.push({ id: newId('msg'), role: 'user', text: q, at: now() });
      if (history.length === 0) session.title = chatTitleFrom(q);
      session.updatedAt = now();
      store.save(data);

      const answer = await ask(chatPrompt(history, q), onDelta, signal);

      // Re-load before writing the reply: another turn/window may have saved
      // meanwhile, and the session may have been deleted mid-stream.
      const reply: ChatMessage = { id: newId('msg'), role: 'assistant', text: answer.text, at: now() };
      const fresh = store.load();
      const target = bySession(fresh.sessions, sessionId);
      if (target) {
        target.messages.push(reply);
        target.updatedAt = now();
        store.save(fresh);
      }
      return reply;
    },
  };
}
