import { defineConfig } from 'drizzle-kit';

/**
 * Postgres everywhere (P7 goes straight to Postgres — see SHIPPING.md): dev
 * points at the docker-compose.yml instance, prod at the deploy-stack DB via
 * DATABASE_URL. Migrations in ./drizzle are committed; regenerate with
 * `pnpm db:generate` after schema changes, apply with `pnpm db:migrate`.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? 'postgres://cockpitzero:cockpitzero@localhost:5432/cockpitzero',
  },
});
