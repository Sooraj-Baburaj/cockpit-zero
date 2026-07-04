import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('backend routes', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('unknown route returns 404 json', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
  });
});
