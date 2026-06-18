import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('backend routes', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /sync without auth is rejected', async () => {
    const res = await app.request('/sync');
    expect(res.status).toBe(401);
  });

  it('POST /sync with auth but invalid body is rejected', async () => {
    const res = await app.request('/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 999 }),
    });
    expect(res.status).toBe(400);
  });

  it('unknown route returns 404 json', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
  });
});
