import { defineConfig } from 'drizzle-kit';

/**
 * Local dev uses SQLite (libSQL). To target Postgres for prod, change
 * `dialect` to 'postgresql' and point DATABASE_URL at your Postgres instance
 * (see src/db/index.ts for the matching driver swap).
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./drizzle/dev.sqlite',
  },
});
