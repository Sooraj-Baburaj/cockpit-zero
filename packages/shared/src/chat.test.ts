import { describe, it, expect } from 'vitest';
import {
  ChatStoreSchema,
  chatPrompt,
  chatSummary,
  chatTitleFrom,
  type ChatMessage,
} from './chat.js';

function msg(role: ChatMessage['role'], text: string, at = 0): ChatMessage {
  return { id: `${role}-${at}`, role, text, at };
}

describe('ChatStoreSchema', () => {
  it('fills defaults and validates a round-trip', () => {
    const empty = ChatStoreSchema.parse({});
    expect(empty).toEqual({ version: 1, sessions: [] });

    const store = ChatStoreSchema.parse({
      sessions: [{ id: 's1', createdAt: 1, updatedAt: 2, messages: [msg('user', 'hi', 1)] }],
    });
    expect(store.sessions[0]!.title).toBe('New chat');
    expect(ChatStoreSchema.parse(JSON.parse(JSON.stringify(store)))).toEqual(store);
  });

  it('rejects a corrupt store (the loader falls back to empty)', () => {
    expect(ChatStoreSchema.safeParse({ sessions: [{ id: '' }] }).success).toBe(false);
    expect(ChatStoreSchema.safeParse('not a store').success).toBe(false);
  });
});

describe('chatTitleFrom', () => {
  it('takes the first line and keeps short titles whole', () => {
    expect(chatTitleFrom('Plan my week\nwith details')).toBe('Plan my week');
  });

  it('ellipsizes long titles at a word boundary', () => {
    const title = chatTitleFrom(
      'Summarize the quarterly revenue brief and highlight the three biggest risks for the board',
    );
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toContain('  ');
  });

  it('keeps the default for blank input', () => {
    expect(chatTitleFrom('   \n ')).toBe('New chat');
  });
});

describe('chatSummary', () => {
  it('exposes the sidebar fields without the transcript', () => {
    const s = chatSummary({
      id: 's1',
      title: 'Plan my week',
      createdAt: 1,
      updatedAt: 9,
      messages: [msg('user', 'hi'), msg('assistant', 'hello')],
    });
    expect(s).toEqual({ id: 's1', title: 'Plan my week', updatedAt: 9, messageCount: 2 });
  });
});

describe('chatPrompt', () => {
  it('passes a first message through untouched', () => {
    expect(chatPrompt([], 'What can you do?')).toBe('What can you do?');
  });

  it('folds prior turns into a transcript before the new message', () => {
    const prompt = chatPrompt(
      [msg('user', 'What shipped this week?'), msg('assistant', 'The launcher redesign.')],
      'Write release notes for it',
    );
    expect(prompt).toContain('User: What shipped this week?');
    expect(prompt).toContain('Assistant: The launcher redesign.');
    expect(prompt).toContain('User: Write release notes for it');
    // The new message comes after the history it depends on.
    expect(prompt.indexOf('release notes')).toBeGreaterThan(prompt.indexOf('launcher redesign'));
  });

  it('trims old history to the char budget, keeping the newest turns', () => {
    const filler = 'x'.repeat(5_000);
    const history = [
      msg('user', `oldest ${filler}`),
      msg('assistant', `middle ${filler}`),
      msg('user', `newest ${filler}`),
    ];
    const prompt = chatPrompt(history, 'continue');
    expect(prompt).toContain('newest');
    expect(prompt).toContain('middle');
    expect(prompt).not.toContain('oldest');
  });
});
