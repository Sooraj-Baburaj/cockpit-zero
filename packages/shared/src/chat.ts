import { z } from 'zod';

/**
 * The AI chat surface's data shapes + pure helpers (the dedicated AI window).
 * Sessions persist locally in the desktop app (`userData/chats.json` — NOT
 * `config.json`, which syncs); the schemas validate that file on every load so
 * a corrupt store degrades to empty instead of crashing the screen. No React,
 * no `electron` — the prompt/title/summary logic is unit-testable here.
 */

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  /** Epoch ms. */
  at: z.number(),
});

export const ChatSessionSchema = z.object({
  id: z.string().min(1),
  /** Derived from the first user message (see {@link chatTitleFrom}). */
  title: z.string().default('New chat'),
  createdAt: z.number(),
  updatedAt: z.number(),
  messages: z.array(ChatMessageSchema).default([]),
});

/** What `userData/chats.json` holds. */
export const ChatStoreSchema = z.object({
  version: z.literal(1).default(1),
  sessions: z.array(ChatSessionSchema).default([]),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type ChatStore = z.infer<typeof ChatStoreSchema>;

/** The sidebar row shape — full transcripts stay behind `chatGet`. */
export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

export function chatSummary(session: ChatSession): ChatSummary {
  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
  };
}

const TITLE_MAX = 48;

/** Derive a session title from its first user message: first line, trimmed,
 *  ellipsized at a word boundary. Empty input keeps the "New chat" default. */
export function chatTitleFrom(text: string): string {
  const line = text.trim().split('\n')[0]?.trim() ?? '';
  if (line === '') return 'New chat';
  if (line.length <= TITLE_MAX) return line;
  const cut = line.slice(0, TITLE_MAX);
  const atWord = cut.lastIndexOf(' ');
  return `${(atWord > TITLE_MAX / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

/** How much prior conversation is folded into a follow-up prompt. Keeps the
 *  provider request bounded no matter how long a session gets. */
const HISTORY_CHAR_BUDGET = 12_000;

/**
 * Build the provider prompt for the next turn of a chat: the prior exchanges as
 * a compact transcript (newest-first trimmed to a char budget), then the new
 * user message. Used by the desktop chat service so multi-turn context works
 * over the existing single-prompt `askStream` path for every provider.
 */
export function chatPrompt(history: readonly ChatMessage[], next: string): string {
  if (history.length === 0) return next;

  // Walk backwards so the budget keeps the most recent context.
  const lines: string[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const m = history[i]!;
    const line = `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.trim()}`;
    if (used + line.length > HISTORY_CHAR_BUDGET) break;
    lines.unshift(line);
    used += line.length;
  }

  return (
    'You are continuing an ongoing conversation. The transcript so far:\n\n' +
    `${lines.join('\n\n')}\n\n` +
    `User: ${next}\n\n` +
    'Reply to the last user message, using the transcript for context.'
  );
}
