import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { env } from '../env.js';

/**
 * Postgres via node-postgres (P7 — dev runs docker-compose.yml, prod the
 * deploy stack). Tests set `DATABASE_URL=pglite://memory` to get **PGlite**:
 * real in-process Postgres (WASM), so `app.request(...)` tests run with zero
 * infrastructure. Both are the pg dialect over the same schema, so the query
 * builder type is shared; the PGlite instance is structurally compatible and
 * cast accordingly.
 */
export type Db = NodePgDatabase<typeof schema>;

async function createDb(): Promise<Db> {
  if (env.DATABASE_URL.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    // pgvector compiled for PGlite — so the P8 memory/knowledge tables (vector
    // columns + hnsw indexes) work in tests exactly like on the real Postgres.
    const { vector } = await import('@electric-sql/pglite-pgvector');
    const { drizzle } = await import('drizzle-orm/pglite');
    return drizzle(new PGlite({ extensions: { vector } }), { schema }) as unknown as Db;
  }
  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  return drizzle(new pg.Pool({ connectionString: env.DATABASE_URL }), { schema });
}

export const db = await createDb();
export { schema };
