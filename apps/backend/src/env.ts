import { z } from 'zod';

/** Validated process environment. Fails fast at startup if misconfigured. */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1).default('file:./drizzle/dev.sqlite'),
  AUTH_SECRET: z.string().min(1).default('change-me-in-production'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
