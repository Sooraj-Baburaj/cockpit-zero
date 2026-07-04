import { describe, expect, it } from 'vitest';
import type { MemorySyncRecord, MemorySyncResponse } from '@cockpitzero/shared';
import { app } from '../src/app.js';
import { authed, signUpToken } from './helpers.js';

/**
 * Cloud memory routes (P8) against the real app + PGlite w/ pgvector — sync
 * upsert/LWW/dedup and server hybrid search. Embeddings are the deterministic
 * keyless hash embedder (no OPENAI_API_KEY in tests), so search assertions are
 * stable.
 */

const record = (
  over: Partial<MemorySyncRecord> & { id: string; text: string },
): MemorySyncRecord => ({
  ts: 1_000,
  updatedAt: 1_000,
  kind: 'fact',
  importance: 0.6,
  ...over,
});

async function syncRequest(
  token: string,
  body: { since: number | null; entries: MemorySyncRecord[] },
): Promise<MemorySyncResponse> {
  const res = await app.request('/memory/sync', {
    method: 'POST',
    headers: authed(token),
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as MemorySyncResponse;
}

async function search(token: string, q: string): Promise<MemorySyncRecord[]> {
  const res = await app.request(`/memory/search?q=${encodeURIComponent(q)}`, {
    headers: authed(token),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { ok: boolean; entries: MemorySyncRecord[] };
  return body.entries;
}

describe('memory sync', () => {
  it('rejects requests without a session', async () => {
    const post = await app.request('/memory/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since: null, entries: [] }),
    });
    expect(post.status).toBe(401);
    expect((await app.request('/memory/search?q=x')).status).toBe(401);
  });

  it('a memory pushed from device A is pulled by device B (cross-device sync)', async () => {
    const token = await signUpToken('memory-devices@example.com');

    // Device A pushes; nothing to pull yet.
    const a = await syncRequest(token, {
      since: null,
      entries: [record({ id: 'mem_a1', text: 'Prefers the Sahara theme.', updatedAt: 2_000 })],
    });
    expect(a.entries).toHaveLength(0);
    expect(a.now).toBeGreaterThan(0);

    // Device B (fresh cursor, nothing local) pulls it down.
    const b = await syncRequest(token, { since: null, entries: [] });
    expect(b.entries.map((e) => e.id)).toEqual(['mem_a1']);
    expect(b.entries[0]?.text).toBe('Prefers the Sahara theme.');

    // Device B syncs again from its new cursor — no repeat delta.
    const b2 = await syncRequest(token, { since: b.now, entries: [] });
    expect(b2.entries).toHaveLength(0);
  });

  it('conflicts are last-write-wins on updatedAt', async () => {
    const token = await signUpToken('memory-lww@example.com');
    await syncRequest(token, {
      since: null,
      entries: [record({ id: 'mem_1', text: 'Newest phrasing of the fact.', updatedAt: 5_000 })],
    });
    // An older write for the same id must not clobber the newer one.
    await syncRequest(token, {
      since: null,
      entries: [record({ id: 'mem_1', text: 'Stale phrasing.', updatedAt: 4_000 })],
    });
    const pull = await syncRequest(token, { since: null, entries: [] });
    expect(pull.entries).toHaveLength(1);
    expect(pull.entries[0]?.text).toBe('Newest phrasing of the fact.');

    // A newer write does replace it.
    await syncRequest(token, {
      since: null,
      entries: [record({ id: 'mem_1', text: 'Even newer phrasing.', updatedAt: 6_000 })],
    });
    const pull2 = await syncRequest(token, { since: null, entries: [] });
    expect(pull2.entries[0]?.text).toBe('Even newer phrasing.');
  });

  it('dedups the same text pushed under different ids (cross-device duplicate)', async () => {
    const token = await signUpToken('memory-dedup@example.com');
    const text = 'The Q3 board deck lives in ~/Documents/q3-brief.pdf.';
    await syncRequest(token, { since: null, entries: [record({ id: 'mem_devA', text })] });
    await syncRequest(token, {
      since: null,
      entries: [record({ id: 'mem_devB', text, updatedAt: 2_000 })],
    });

    const pull = await syncRequest(token, { since: null, entries: [] });
    expect(pull.entries).toHaveLength(1);
    expect(pull.entries[0]?.id).toBe('mem_devA');
  });

  it('does not echo back what the device just pushed', async () => {
    const token = await signUpToken('memory-echo@example.com');
    const first = await syncRequest(token, {
      since: null,
      entries: [record({ id: 'mem_e1', text: 'Fact one.' })],
    });
    const second = await syncRequest(token, {
      since: first.now,
      entries: [record({ id: 'mem_e2', text: 'Fact two.', updatedAt: Date.now() })],
    });
    expect(second.entries.map((e) => e.id)).not.toContain('mem_e2');
  });

  it('hybrid search surfaces the matching memory first', async () => {
    const token = await signUpToken('memory-search@example.com');
    await syncRequest(token, {
      since: null,
      entries: [
        record({ id: 'mem_s1', text: 'The quarterly board deck lives in Documents.' }),
        record({ id: 'mem_s2', text: 'Prefers dark mode with frosted glass.' }),
        record({ id: 'mem_s3', text: 'Standup happens at 9:30 on weekdays.' }),
      ],
    });
    const hits = await search(token, 'where is the board deck');
    expect(hits[0]?.id).toBe('mem_s1');
    expect(hits.map((h) => h.id)).not.toContain('mem_s3');
  });

  it('memories are per-user (auth-scoped)', async () => {
    const alice = await signUpToken('memory-alice@example.com');
    const bob = await signUpToken('memory-bob@example.com');
    await syncRequest(alice, {
      since: null,
      entries: [record({ id: 'mem_p1', text: 'Alice’s private fact.' })],
    });

    const bobPull = await syncRequest(bob, { since: null, entries: [] });
    expect(bobPull.entries).toHaveLength(0);
    expect(await search(bob, 'private fact')).toHaveLength(0);
  });

  it('rejects a malformed sync body', async () => {
    const token = await signUpToken('memory-invalid@example.com');
    const res = await app.request('/memory/sync', {
      method: 'POST',
      headers: authed(token),
      body: JSON.stringify({ since: 'nope', entries: [{ id: 'x' }] }),
    });
    expect(res.status).toBe(400);
  });
});
