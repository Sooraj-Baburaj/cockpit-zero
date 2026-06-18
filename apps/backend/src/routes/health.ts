import { Hono } from 'hono';

const startedAt = Date.now();

/** Liveness/readiness probe. Real, no auth. */
export const health = new Hono().get('/', (c) =>
  c.json({
    status: 'ok' as const,
    service: 'cockpitzero-backend',
    version: process.env.npm_package_version ?? '0.0.0',
    uptimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  }),
);
