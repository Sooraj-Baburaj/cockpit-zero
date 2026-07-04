import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { db } from '../src/db/index.js';

// Bring the per-worker PGlite database (vitest.config.ts sets
// DATABASE_URL=pglite://memory) to the current schema before any test touches
// the app. The cast is safe: with a pglite DATABASE_URL, `db` really is a
// PgliteDatabase (see src/db/index.ts).
await migrate(db as unknown as PgliteDatabase<Record<string, unknown>>, {
  migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
});
