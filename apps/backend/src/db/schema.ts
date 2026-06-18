import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema for local dev. The column types here map cleanly to Postgres;
 * when swapping to prod, re-author with drizzle-orm/pg-core (text -> text,
 * integer timestamps -> timestamp) and regenerate migrations.
 */

/** Registered devices/users that can sync config (auth-gated, stubbed). */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Latest synced config blob per user (validated against ConfigSchema). */
export const configs = sqliteTable('configs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  /** JSON-serialized Config. */
  payload: text('payload', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type ConfigRow = typeof configs.$inferSelect;
