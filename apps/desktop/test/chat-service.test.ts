import { describe, it, expect } from 'vitest';
import { ChatStoreSchema } from '@cockpitzero/shared';
import type { AiAnswer, ChatStore } from '@cockpitzero/shared';
import { createChatService } from '../src/main/services/ai/chat-service.js';
import type { ChatStorePort } from '../src/main/infra/chat-store.js';

/**
 * The chat service against a fake store + a scripted ask — no electron, no
 * disk, no provider. Persistence rules (user turn before the call, assistant
 * turn after, title from the first message) are the invariants under test.
 */

function fakeStore(): ChatStorePort & { data: () => ChatStore } {
  let data = ChatStoreSchema.parse({});
  return {
    load: () => ChatStoreSchema.parse(JSON.parse(JSON.stringify(data))),
    save: (next) => {
      data = next;
    },
    data: () => data,
  };
}

const answer = (text: string): AiAnswer => ({ text, meta: 'test', suggestions: [] });

function harness(ask?: (prompt: string) => Promise<AiAnswer>) {
  const store = fakeStore();
  const prompts: string[] = [];
  let tick = 0;
  const service = createChatService({
    store,
    ask: async (prompt, onDelta) => {
      prompts.push(prompt);
      if (ask) return ask(prompt);
      onDelta('Hello ');
      onDelta('there.');
      return answer('Hello there.');
    },
    now: () => ++tick,
    newId: (prefix) => `${prefix}_${++tick}`,
  });
  return { service, store, prompts };
}

describe('chat service', () => {
  it('create() starts a session and reuses the newest empty one', () => {
    const { service } = harness();
    const a = service.create();
    expect(a.title).toBe('New chat');
    // "New chat" spam reuses the empty session instead of littering the sidebar.
    expect(service.create().id).toBe(a.id);
    expect(service.list()).toHaveLength(1);
  });

  it('ask() persists the user turn, streams, then persists the reply + title', async () => {
    const { service } = harness();
    const session = service.create();

    const deltas: string[] = [];
    const reply = await service.ask(session.id, 'Plan my week', (t) => deltas.push(t));

    expect(deltas.join('')).toBe('Hello there.');
    expect(reply.role).toBe('assistant');

    const stored = service.get(session.id)!;
    expect(stored.title).toBe('Plan my week');
    expect(stored.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(stored.messages[1]!.text).toBe('Hello there.');
  });

  it('folds prior turns into the follow-up prompt (multi-turn context)', async () => {
    const { service, prompts } = harness();
    const session = service.create();
    await service.ask(session.id, 'What shipped this week?', () => {});
    await service.ask(session.id, 'Write release notes', () => {});

    expect(prompts[0]).toBe('What shipped this week?');
    expect(prompts[1]).toContain('User: What shipped this week?');
    expect(prompts[1]).toContain('Assistant: Hello there.');
    expect(prompts[1]).toContain('User: Write release notes');
  });

  it('ask() rejects blank text and unknown sessions', async () => {
    const { service } = harness();
    const session = service.create();
    await expect(service.ask(session.id, '   ', () => {})).rejects.toThrow('Nothing to send');
    await expect(service.ask('nope', 'hi', () => {})).rejects.toThrow('no longer exists');
  });

  it('keeps the user turn even when the provider call fails', async () => {
    const { service } = harness(async () => {
      throw new Error('provider down');
    });
    const session = service.create();
    await expect(service.ask(session.id, 'hi', () => {})).rejects.toThrow('provider down');
    expect(service.get(session.id)!.messages.map((m) => m.role)).toEqual(['user']);
  });

  it('drops the reply cleanly when the session was deleted mid-stream', async () => {
    const { service } = harness();
    const session = service.create();
    const pending = service.ask(session.id, 'hi', () => {
      // Delete while the (synchronous fake) stream is mid-flight.
      service.remove(session.id);
    });
    await expect(pending).resolves.toMatchObject({ role: 'assistant' });
    expect(service.get(session.id)).toBeNull();
  });

  it('list() returns summaries newest-first; remove() is idempotent', async () => {
    const { service } = harness();
    const a = service.create();
    await service.ask(a.id, 'first chat', () => {});
    const b = service.create();
    await service.ask(b.id, 'second chat', () => {});

    expect(service.list().map((s) => s.title)).toEqual(['second chat', 'first chat']);
    expect(service.remove(a.id)).toEqual({ ok: true });
    expect(service.remove(a.id)).toEqual({ ok: true });
    expect(service.list().map((s) => s.title)).toEqual(['second chat']);
  });
});
