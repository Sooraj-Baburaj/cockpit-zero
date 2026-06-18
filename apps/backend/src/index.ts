import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './env.js';

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`cockpitzero-backend listening on http://localhost:${info.port}`);
});
