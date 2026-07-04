import { z } from 'zod';

/** Validated process environment. Fails fast at startup if misconfigured. */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  /** Postgres connection string (dev default matches docker-compose.yml).
   *  Tests use `pglite://memory` — in-process Postgres, no server. */
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://cockpitzero:cockpitzero@localhost:5432/cockpitzero'),
  /** Signs better-auth sessions/tokens. MUST be overridden in production. */
  BETTER_AUTH_SECRET: z.string().min(1).default('change-me-in-production'),
  /** The public origin this API is served from (OAuth callbacks derive from it). */
  BETTER_AUTH_URL: z.string().url().default('http://localhost:8787'),
  // Social sign-in is optional per provider: a provider is offered only when
  // both its id + secret are present (see src/auth.ts).
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  /** Server-side embeddings for cloud memory + knowledge (P8). When set, texts
   *  are embedded with OpenAI via the AI SDK; otherwise a deterministic keyword
   *  hash embedder of the same dimension keeps dev/tests running keyless
   *  (recall degrades to keyword-overlap quality — set the key in production). */
  OPENAI_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  /** OUR Anthropic key for managed inference (P9) — server-side only, never the
   *  client. When unset, `/inference` responds 503 (managed tier offline). */
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Soft per-user rate cap on `/inference`, requests per minute (abuse guard —
   *  billing/hard quotas are deferred). */
  INFERENCE_RATE_LIMIT_RPM: z.coerce.number().int().positive().default(30),
  /** When set, verification/reset emails go out via Resend; otherwise they are
   *  logged to the server console (dev transport). */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('CockpitZero <onboarding@resend.dev>'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
