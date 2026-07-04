import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import type { KnowledgeDoc, KnowledgeHit } from '@cockpitzero/shared';
import { app } from '../src/app.js';
import { authed, signUpToken } from './helpers.js';

/**
 * Knowledge ingestion routes (P8): ingest (text + a real minimal PDF) → list →
 * hybrid search (with the source doc name for citation) → remove, all per-user.
 * Keyless — embeddings come from the deterministic hash fallback.
 */

async function ingest(
  token: string,
  doc: { name: string; type: 'pdf' | 'text'; content: string },
): Promise<{ status: number; body: { ok: boolean; docId?: string; chunks?: number } }> {
  const res = await app.request('/knowledge', {
    method: 'POST',
    headers: authed(token),
    body: JSON.stringify(doc),
  });
  return { status: res.status, body: (await res.json()) as never };
}

async function list(token: string): Promise<KnowledgeDoc[]> {
  const res = await app.request('/knowledge', { headers: authed(token) });
  expect(res.status).toBe(200);
  return ((await res.json()) as { docs: KnowledgeDoc[] }).docs;
}

async function search(token: string, q: string): Promise<KnowledgeHit[]> {
  const res = await app.request(`/knowledge/search?q=${encodeURIComponent(q)}`, {
    headers: authed(token),
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { hits: KnowledgeHit[] }).hits;
}

/** A minimal but valid single-page PDF containing `text` (correct xref offsets),
 *  so the unpdf extraction path is exercised for real without a fixture file. */
function minimalPdf(text: string): Buffer {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${off.toString().padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

const textUpload = (name: string, text: string) => ({
  name,
  type: 'text' as const,
  content: Buffer.from(text, 'utf8').toString('base64'),
});

describe('knowledge', () => {
  it('rejects requests without a session', async () => {
    expect((await app.request('/knowledge')).status).toBe(401);
    const post = await app.request('/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textUpload('notes.txt', 'hello')),
    });
    expect(post.status).toBe(401);
  });

  it('ingest → list → search → remove round-trip (text document)', async () => {
    const token = await signUpToken('knowledge-roundtrip@example.com');

    const { status, body } = await ingest(
      token,
      textUpload(
        'launch-notes.txt',
        'The CDN cutover needs sign-off from infra before Thursday. ' +
          'Staging is green and QA starts at 2pm.',
      ),
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.chunks).toBeGreaterThan(0);

    const docs = await list(token);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      docId: body.docId,
      name: 'launch-notes.txt',
      status: 'ready',
      chunks: body.chunks,
    });

    // Searchable + citable: the hit carries the source document's name.
    const hits = await search(token, 'CDN cutover sign-off');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.docName).toBe('launch-notes.txt');
    expect(hits[0]?.chunk).toContain('CDN cutover');

    // Removal really deletes — the doc AND its chunks disappear.
    const del = await app.request(`/knowledge/${body.docId}`, {
      method: 'DELETE',
      headers: authed(token),
    });
    expect(((await del.json()) as { ok: boolean }).ok).toBe(true);
    expect(await list(token)).toHaveLength(0);
    expect(await search(token, 'CDN cutover sign-off')).toHaveLength(0);
  });

  it('ingests a real PDF and makes its content recallable', async () => {
    const token = await signUpToken('knowledge-pdf@example.com');
    const pdf = minimalPdf('The quarterly revenue target is 4.2 million dollars');

    const { status, body } = await ingest(token, {
      name: 'q3-brief.pdf',
      type: 'pdf',
      content: pdf.toString('base64'),
    });
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const hits = await search(token, 'quarterly revenue target');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.docName).toBe('q3-brief.pdf');
    expect(hits[0]?.chunk).toContain('quarterly revenue target');
  });

  it('rejects an upload with no extractable text', async () => {
    const token = await signUpToken('knowledge-empty@example.com');
    const { status, body } = await ingest(token, textUpload('blank.txt', '   \n \n '));
    expect(status).toBe(422);
    expect(body.ok).toBe(false);
  });

  it('knowledge is per-user (auth-scoped)', async () => {
    const alice = await signUpToken('knowledge-alice@example.com');
    const bob = await signUpToken('knowledge-bob@example.com');
    const { body } = await ingest(alice, textUpload('alice.txt', 'Alice’s secret roadmap.'));

    expect(await list(bob)).toHaveLength(0);
    expect(await search(bob, 'secret roadmap')).toHaveLength(0);

    // Bob can't delete Alice's document either.
    const del = await app.request(`/knowledge/${body.docId}`, {
      method: 'DELETE',
      headers: authed(bob),
    });
    expect(((await del.json()) as { ok: boolean }).ok).toBe(false);
    expect(await list(alice)).toHaveLength(1);
  });
});
