import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import { env } from '../env.js';

/**
 * Local dev: libSQL/SQLite. To target Postgres for prod, replace the two
 * imports above with:
 *   import { drizzle } from 'drizzle-orm/node-postgres';
 *   import pg from 'pg';
 * and construct `drizzle(new pg.Pool({ connectionString: env.DATABASE_URL }), { schema })`.
 * Nothing else in the app references the driver directly.
 */
const client = createClient({ url: env.DATABASE_URL });

export const db = drizzle(client, { schema });
export { schema };
