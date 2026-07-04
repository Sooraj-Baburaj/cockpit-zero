import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core';
import type { Config } from '@cockpitzero/shared';

/**
 * Postgres schema (P7 — straight to Postgres per SHIPPING.md; dev runs the
 * docker-compose.yml Postgres, tests run PGlite). The four auth tables mirror
 * better-auth's required core schema (drizzle adapter, `usePlural`) — column
 * *property* names must match better-auth's field names exactly; the snake_case
 * DB names are our convention. `plan` is the P7 entitlements field
 * (`additionalFields` in src/auth.ts): default `free`, flipped manually to test
 * P9 until Stripe lands.
 */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  plan: text('plan', { enum: ['free', 'pro'] })
    .notNull()
    .default('free'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Credential (password hash) + linked OAuth provider accounts, per better-auth. */
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Email-verification / password-reset tokens, per better-auth. */
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** Latest synced config per user (validated against ConfigSchema on write).
 *  `userId` is the PK — one row per user, last-write-wins on `updatedAt`. */
export const configs = pgTable('configs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').$type<Config>().notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * The cloud index's embedding dimension (P8). The server **re-embeds** every
 * synced/ingested text with its own model (`src/embedder.ts` — OpenAI
 * `text-embedding-3-small`, 1536-dim, or the same-dimension hash fallback), so
 * the cloud index is internally consistent regardless of what dimension each
 * device uses locally. Changing this requires a migration + full re-embed.
 */
export const EMBEDDING_DIM = 1536;

/**
 * Cloud memories (P8): the pgvector twin of the desktop's LanceDB store, one row
 * per remembered fact per user. Ids are client-generated (`mem_…`), so the PK is
 * composite — two users can hold the same id. `ts`/`updatedAt` are epoch ms to
 * match `MemoryRecord`; `updatedAt` is the LWW conflict key for sync.
 */
export const memories = pgTable(
  'memories',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    kind: text('kind').notNull(),
    importance: real('importance').notNull(),
    ts: bigint('ts', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    source: text('source'),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIM }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('memories_user_updated_idx').on(t.userId, t.updatedAt),
    index('memories_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

/** One ingested knowledge document per row (P8) — the ingest-job/list unit; its
 *  text lives in `knowledge` chunks (cascade-deleted with it). */
export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Provenance, e.g. `upload:pdf` / `upload:text`. */
    source: text('source').notNull(),
    status: text('status', { enum: ['ready', 'error'] })
      .notNull()
      .default('ready'),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('documents_user_idx').on(t.userId)],
);

/** Knowledge chunks (P8): a document split by the text splitter, one embedded
 *  chunk per row, searched with the same hybrid recall as memories. */
export const knowledge = pgTable(
  'knowledge',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    docId: text('doc_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    /** The chunk's position within its document (stable citation order). */
    seq: integer('seq').notNull(),
    chunk: text('chunk').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIM }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('knowledge_user_idx').on(t.userId),
    index('knowledge_doc_idx').on(t.docId),
    index('knowledge_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

/**
 * Managed-inference usage meter (P9): one row per `/inference` request, per
 * user. Billing is deferred — this is the meter a later Stripe phase reads
 * (and what `GET /usage` aggregates for the Console readout). `costEstimate`
 * is USD, computed from the router's per-model price map at write time so the
 * row stays meaningful even after prices change.
 */
export const usage = pgTable(
  'usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Epoch ms of the request (matches the desktop's timestamp convention). */
    ts: bigint('ts', { mode: 'number' }).notNull(),
    model: text('model').notNull(),
    /** The router's internal tier that picked the model ('mini' | 'standard' | 'pro'). */
    tier: text('tier').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costEstimate: real('cost_estimate').notNull(),
    requestId: text('request_id').notNull(),
  },
  (t) => [index('usage_user_ts_idx').on(t.userId, t.ts)],
);

export type User = typeof users.$inferSelect;
export type UsageRow = typeof usage.$inferSelect;
export type ConfigRow = typeof configs.$inferSelect;
export type MemoryRow = typeof memories.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type KnowledgeRow = typeof knowledge.$inferSelect;
